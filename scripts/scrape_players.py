r"""
Scrape NBA player career stats into a static players.json for the game.

WHAT IT DOES
  1. Pulls the full static player list (bundled with nba_api, offline).
  2. For each player, fetches career regular-season totals from stats.nba.com.
  3. Filters to "notable" players (min career games played).
  4. Computes per-game rate stats + a popularity proxy.
  5. Writes app/data/players.json (served statically by the Next.js game).

WHY IT RUNS LOCALLY
  stats.nba.com throttles rapid requests and blocks many cloud IPs, so this
  runs on your machine with a pause between calls. A full run over all players
  takes a while (often 30-60+ min). You only run it occasionally.

USAGE
  .\.venv\Scripts\python.exe scripts\scrape_players.py

  # Quick test on a small sample first:
  .\.venv\Scripts\python.exe scripts\scrape_players.py --limit 25

  # Resume a run that got interrupted (skips players already in the cache):
  .\.venv\Scripts\python.exe scripts\scrape_players.py --resume

OUTPUT
  scripts/.cache_career.json  -> raw per-player cache (for resuming)
  app/data/players.json       -> final cleaned dataset for the game
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from nba_api.stats.static import players as static_players
from nba_api.stats.endpoints import playercareerstats
from requests.exceptions import ReadTimeout, ConnectionError as ReqConnectionError

# ---------------------------------------------------------------------------
# Tunable filters — change these to reshape the player pool.
# ---------------------------------------------------------------------------
MIN_CAREER_GP = 400          # exclude cup-of-coffee players
REQUEST_PAUSE_SEC = 0.6      # delay between stats.nba.com calls (rate limiting)
REQUEST_TIMEOUT_SEC = 30     # per-request timeout
MAX_RETRIES = 3              # retries per player on timeout/connection error
RETRY_BACKOFF_SEC = 2.0      # base backoff; multiplied by attempt number

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent
CACHE_PATH = REPO_ROOT / "scripts" / ".cache_career.json"
OUTPUT_PATH = REPO_ROOT / "app" / "data" / "players.json"


def load_cache() -> dict:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    return {}


def save_cache(cache: dict) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache, indent=2), encoding="utf-8")


def fetch_career_totals(player_id: int) -> dict | None:
    """Fetch one player's career regular-season totals. Returns None on no data."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            career = playercareerstats.PlayerCareerStats(
                player_id=player_id,
                timeout=REQUEST_TIMEOUT_SEC,
            )
            totals = career.career_totals_regular_season.get_data_frame()
            seasons = career.season_totals_regular_season.get_data_frame()
            if totals.empty:
                return None
            row = totals.iloc[0]
            # Collect the set of team abbreviations the player suited up for.
            teams = []
            if not seasons.empty:
                teams = [
                    t for t in seasons["TEAM_ABBREVIATION"].tolist()
                    if isinstance(t, str) and t and t != "TOT"
                ]
            # De-dup while preserving order.
            seen = set()
            teams = [t for t in teams if not (t in seen or seen.add(t))]
            # Count DISTINCT seasons: a mid-season trade produces multiple
            # rows for the same SEASON_ID, so len(seasons) over-counts.
            distinct_seasons = (
                int(seasons["SEASON_ID"].nunique()) if not seasons.empty else 0
            )
            return {
                "gp": int(row["GP"]),
                "min": int(row["MIN"]),
                "pts": int(row["PTS"]),
                "reb": int(row["REB"]),
                "ast": int(row["AST"]),
                "stl": int(row["STL"]),
                "blk": int(row["BLK"]),
                "fg3m": int(row["FG3M"]),
                "teams": teams,
                "seasons": distinct_seasons,
            }
        except (ReadTimeout, ReqConnectionError) as exc:
            wait = RETRY_BACKOFF_SEC * attempt
            print(f"    timeout/conn error (attempt {attempt}/{MAX_RETRIES}), "
                  f"retrying in {wait:.0f}s: {exc}")
            time.sleep(wait)
        except Exception as exc:  # noqa: BLE001 - log & skip unexpected row issues
            print(f"    unexpected error, skipping: {exc}")
            return None
    print("    giving up after retries")
    return None


def build_dataset(cache: dict) -> list[dict]:
    """Turn the raw cache into the cleaned, filtered game dataset."""
    out = []
    for pid, rec in cache.items():
        stats = rec.get("stats")
        if not stats:
            continue
        gp = stats["gp"]
        if gp < MIN_CAREER_GP:
            continue
        # per-game rate stats, rounded to 1 decimal
        def pg(v: int) -> float:
            return round(v / gp, 1) if gp else 0.0

        out.append({
            "id": int(pid),
            "name": rec["name"],
            "teams": stats["teams"],
            "seasons": stats["seasons"],
            "gp": gp,
            # counting totals
            "pts": stats["pts"],
            "reb": stats["reb"],
            "ast": stats["ast"],
            "stl": stats["stl"],
            "blk": stats["blk"],
            "fg3m": stats["fg3m"],
            # per-game averages
            "ppg": pg(stats["pts"]),
            "rpg": pg(stats["reb"]),
            "apg": pg(stats["ast"]),
            "spg": pg(stats["stl"]),
            "bpg": pg(stats["blk"]),
            # popularity proxy: longevity + scoring, normalized later in UI
            "popularity": stats["pts"] + stats["gp"] * 10,
        })
    # Sort by popularity so the file is easy to eyeball; game re-sorts anyway.
    out.sort(key=lambda p: p["popularity"], reverse=True)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape NBA player career stats.")
    parser.add_argument("--limit", type=int, default=None,
                        help="Only process the first N players (for testing).")
    parser.add_argument("--resume", action="store_true",
                        help="Skip players already in the cache.")
    parser.add_argument("--active-only", action="store_true",
                        help="Only scrape currently active players (fast test).")
    args = parser.parse_args()

    roster = static_players.get_players()
    if args.active_only:
        roster = [p for p in roster if p.get("is_active")]
    if args.limit:
        roster = roster[: args.limit]

    cache = load_cache() if args.resume else load_cache()
    total = len(roster)
    print(f"Players to process: {total}")
    print(f"Cache entries loaded: {len(cache)}")
    print(f"Filter: >= {MIN_CAREER_GP} career games, regular season only\n")

    for i, p in enumerate(roster, start=1):
        pid = str(p["id"])
        name = p["full_name"]

        if args.resume and pid in cache and cache[pid].get("stats") is not None:
            continue

        print(f"[{i}/{total}] {name} (id={pid})")
        stats = fetch_career_totals(p["id"])
        cache[pid] = {"name": name, "stats": stats}

        # Persist cache every 20 players so an interrupt loses little work.
        if i % 20 == 0:
            save_cache(cache)
            print(f"    ...cache checkpoint saved ({len(cache)} entries)")

        time.sleep(REQUEST_PAUSE_SEC)

    save_cache(cache)
    print(f"\nRaw cache saved: {CACHE_PATH}")

    dataset = build_dataset(cache)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(dataset, indent=2), encoding="utf-8")
    print(f"Wrote {len(dataset)} notable players -> {OUTPUT_PATH}")

    if dataset:
        print("\nTop 5 by popularity proxy:")
        for p in dataset[:5]:
            print(f"  {p['name']:<24} {p['ppg']} PPG  {p['pts']} pts  {p['gp']} GP")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted. Re-run with --resume to continue.", file=sys.stderr)
        sys.exit(130)
