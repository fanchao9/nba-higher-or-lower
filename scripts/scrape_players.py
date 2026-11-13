r"""
Scrape NBA player career stats into a static players.json for the game.

WHAT IT DOES
  1. Pulls the full static player list (bundled with nba_api, offline).
  2. For each player, fetches career regular-season totals AND every
     season's stat line from stats.nba.com (one request per player).
  3. Filters to "notable" players (min career games played).
  4. For notable players only, fetches their awards (one more request each).
  5. Computes per-game rate stats + a popularity proxy.
  6. Keeps only each player's AWARD-WINNING seasons (see AWARD_CODES), with
     that season's stats, for the season-vs-season game mode.
  7. Writes app/data/players.json (served statically by the Next.js game).

WHY IT RUNS LOCALLY
  stats.nba.com throttles rapid requests and blocks many cloud IPs, so this
  runs on your machine with a pause between calls. A full run covers ~5,200
  players (~0.5s per request + the pause) and takes roughly 1.5-2 hours. You
  only run it occasionally.

USAGE
  .\.venv\Scripts\python.exe scripts\scrape_players.py

  # Quick test on a small sample first:
  .\.venv\Scripts\python.exe scripts\scrape_players.py --limit 25

  # Resume a run that got interrupted (skips players already in the cache):
  .\.venv\Scripts\python.exe scripts\scrape_players.py --resume

OUTPUT
  scripts/.cache_career.json  -> raw per-player cache (for resuming)
  app/data/players.json       -> final cleaned dataset for the game

  Each player has an `award_seasons` array, e.g.:
    {"season": "2008-09", "team": "CLE", "gp": 81, "mpg": 37.7,
     "ppg": 28.4, "rpg": 7.6, "apg": 7.2, "spg": 1.7, "bpg": 1.1,
     "fg3m": 106, "fg_pct": 0.489, "fg3_pct": 0.344, "ft_pct": 0.78,
     "awards": ["MVP", "ALL_NBA_1"]}
  Stats the NBA didn't track in that era (steals/blocks before 1973-74,
  3-pointers before 1979-80, minutes for some early seasons) are null.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from nba_api.stats.static import players as static_players
from nba_api.stats.endpoints import playerawards, playercareerstats
from requests.exceptions import ReadTimeout, ConnectionError as ReqConnectionError

# Filters — change these to reshape the player pool.
MIN_CAREER_GP = 500
REQUEST_PAUSE_SEC = 0.6      # delay between stats.nba.com calls (rate limiting)
REQUEST_TIMEOUT_SEC = 30
MAX_RETRIES = 3
RETRY_BACKOFF_SEC = 2.0

AWARD_CODES = {
    "NBA Most Valuable Player": "MVP",
    "NBA Finals Most Valuable Player": "FMVP",
    "NBA Defensive Player of the Year": "DPOY",
    "NBA Rookie of the Year": "ROY",
    "NBA Most Improved Player": "MIP",
    "NBA Sixth Man of the Year": "6MOY",
    "NBA Clutch Player of the Year": "CPOY",
}
ALL_NBA_DESCRIPTION = "All-NBA"
AWARD_ORDER = [
    "MVP", "FMVP", "DPOY", "ROY", "MIP", "6MOY", "CPOY",
    "ALL_NBA_1", "ALL_NBA_2", "ALL_NBA_3",
]
# Omit weekly/monthly awards
IGNORED_AWARD_MARKERS = ("of the Week", "of the Month")

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


# Early-era rows have missing stats (e.g. Wilt Chamberlain has no steals/blocks/3PM)
# int(None) would crash and silently drop the player.
def _missing(v) -> bool:
    return v is None or v != v


def _int(v) -> int | None:
    return None if _missing(v) else int(v)


def _float(v) -> float | None:
    return None if _missing(v) else float(v)


def _with_retries(call):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return call()
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


def summarize_seasons(seasons) -> list[dict]:
    """One compact record per season (raw totals), from the season DataFrame.

    A mid-season trade yields one row per team plus a combined "TOT" row. We
    use the TOT row for the stats and join the team abbreviations ("MIA/CLE").
    """
    out = []
    for season_id, rows in seasons.groupby("SEASON_ID", sort=False):
        tot = rows[rows["TEAM_ABBREVIATION"] == "TOT"]
        src = tot.iloc[0] if not tot.empty else rows.iloc[0]
        stints = [
            t for t in rows["TEAM_ABBREVIATION"].tolist()
            if isinstance(t, str) and t and t != "TOT"
        ]
        out.append({
            "season": str(season_id),
            "team": "/".join(stints) if stints else None,
            "gp": _int(src["GP"]),
            "min": _int(src["MIN"]),
            "pts": _int(src["PTS"]),
            "reb": _int(src["REB"]),
            "ast": _int(src["AST"]),
            "stl": _int(src["STL"]),
            "blk": _int(src["BLK"]),
            "fg3m": _int(src["FG3M"]),
            "fg_pct": _float(src["FG_PCT"]),
            "fg3_pct": _float(src["FG3_PCT"]),
            "ft_pct": _float(src["FT_PCT"]),
        })
    return out


def fetch_career_totals(player_id: int) -> dict | None:
    """Fetch one player's career + per-season regular-season totals.

    Returns None on no data / failure.
    """
    def call() -> dict | None:
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
            "gp": _int(row["GP"]),
            "min": _int(row["MIN"]),
            "pts": _int(row["PTS"]),
            "reb": _int(row["REB"]),
            "ast": _int(row["AST"]),
            "stl": _int(row["STL"]),
            "blk": _int(row["BLK"]),
            "fg3m": _int(row["FG3M"]),
            "teams": teams,
            "seasons": distinct_seasons,
            "season_rows": summarize_seasons(seasons) if not seasons.empty else [],
        }

    return _with_retries(call)


def fetch_awards(player_id: int) -> list | None:
    """Fetch a player's awards as [season, description, all_nba_team] triples.

    Weekly/monthly awards are dropped. Returns None on failure (so the player
    is retried on --resume); an empty list means "fetched, no awards".
    """
    def call() -> list:
        df = playerawards.PlayerAwards(
            player_id=player_id,
            timeout=REQUEST_TIMEOUT_SEC,
        ).player_awards.get_data_frame()
        out = []
        for _, r in df.iterrows():
            desc = r["DESCRIPTION"]
            if not isinstance(desc, str):
                continue
            if any(marker in desc for marker in IGNORED_AWARD_MARKERS):
                continue
            team_no = r["ALL_NBA_TEAM_NUMBER"]
            out.append([
                str(r["SEASON"]),
                desc,
                str(team_no).strip() if isinstance(team_no, str) else "",
            ])
        return out

    return _with_retries(call)


def award_code(description: str, all_nba_team: str) -> str | None:
    """Map a raw award to its short code, or None if we don't keep it."""
    if description == ALL_NBA_DESCRIPTION:
        return f"ALL_NBA_{all_nba_team}" if all_nba_team in ("1", "2", "3") else None
    return AWARD_CODES.get(description)


def build_award_seasons(stats: dict, awards: list | None) -> list[dict]:
    """Season stat lines for seasons in which the player won a kept award."""
    if not awards:
        return []
    codes_by_season: dict[str, set[str]] = {}
    for season, description, team_no in awards:
        code = award_code(description, team_no)
        if code:
            codes_by_season.setdefault(season, set()).add(code)

    def rate(total: int | None, gp: int | None) -> float | None:
        return round(total / gp, 1) if total is not None and gp else None

    out = []
    for row in stats.get("season_rows", []):
        codes = codes_by_season.get(row["season"])
        if not codes:
            continue
        gp = row["gp"]
        out.append({
            "season": row["season"],
            "team": row["team"],
            "gp": gp,
            "mpg": rate(row["min"], gp),
            "ppg": rate(row["pts"], gp),
            "rpg": rate(row["reb"], gp),
            "apg": rate(row["ast"], gp),
            "spg": rate(row["stl"], gp),
            "bpg": rate(row["blk"], gp),
            "fg3m": row["fg3m"],
            "fg_pct": row["fg_pct"],
            "fg3_pct": row["fg3_pct"],
            "ft_pct": row["ft_pct"],
            "awards": [c for c in AWARD_ORDER if c in codes],
        })
    out.sort(key=lambda s: s["season"])
    return out


def build_dataset(cache: dict) -> list[dict]:
    """Turn the raw cache into the cleaned, filtered game dataset."""
    out = []
    for pid, rec in cache.items():
        stats = rec.get("stats")
        if not stats:
            continue
        gp = stats["gp"]
        if not gp or gp < MIN_CAREER_GP:
            continue
        # Per-game rate stats, rounded to 1 decimal (None if never tracked).
        # Divide only by games from seasons where the stat was recorded, so
        # eras without steals/blocks (pre-1973-74) don't drag the average down.
        def pg(key: str) -> float | None:
            num = den = 0
            for r in stats.get("season_rows", []):
                if r[key] is not None and r["gp"]:
                    num += r[key]
                    den += r["gp"]
            if den:
                return round(num / den, 1)
            # Old cache entry without season rows: fall back to total / GP.
            if not stats.get("season_rows") and stats[key] is not None:
                return round(stats[key] / gp, 1)
            return None

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
            "ppg": pg("pts"),
            "rpg": pg("reb"),
            "apg": pg("ast"),
            "spg": pg("stl"),
            "bpg": pg("blk"),
            # popularity proxy: longevity + scoring, normalized later in UI
            "popularity": (stats["pts"] or 0) + gp * 10,
            # seasons with an MVP / All-NBA / etc., for the season game mode
            "award_seasons": build_award_seasons(stats, rec.get("awards")),
        })
    # Sort by popularity so the file is easy to eyeball. game re-sorts anyway.
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

    cache = load_cache()
    total = len(roster)
    print(f"Players to process: {total}")
    print(f"Cache entries loaded: {len(cache)}")
    print(f"Filter: >= {MIN_CAREER_GP} career games, regular season only\n")

    # Stage 1: career + per-season stats for every player
    print("Stage 1/2: career and season stats")
    for i, p in enumerate(roster, start=1):
        pid = str(p["id"])
        name = p["full_name"]

        cached = cache.get(pid, {}).get("stats")
        if args.resume and cached is not None and "season_rows" in cached:
            continue

        print(f"[{i}/{total}] {name} (id={pid})")
        stats = fetch_career_totals(p["id"])
        prior = cache.get(pid, {})
        cache[pid] = {"name": name, "stats": stats}
        if "awards" in prior:
            cache[pid]["awards"] = prior["awards"]

        # Persist cache every 20 players so an interrupt loses little work.
        if i % 20 == 0:
            save_cache(cache)
            print(f"    ...cache checkpoint saved ({len(cache)} entries)")

        time.sleep(REQUEST_PAUSE_SEC)

    save_cache(cache)

    # Stage 2: awards, only for players who pass the games filter
    roster_ids = {str(p["id"]) for p in roster}
    notable = [
        (pid, rec) for pid, rec in cache.items()
        if pid in roster_ids
        and rec.get("stats")
        and rec["stats"]["gp"]
        and rec["stats"]["gp"] >= MIN_CAREER_GP
    ]
    print(f"\nStage 2/2: awards for {len(notable)} notable players")
    for n, (pid, rec) in enumerate(notable, start=1):
        if args.resume and "awards" in rec:
            continue

        print(f"[{n}/{len(notable)}] {rec['name']} (id={pid}) awards")
        awards = fetch_awards(int(pid))
        if awards is not None:
            rec["awards"] = awards

        if n % 20 == 0:
            save_cache(cache)
            print(f"    ...cache checkpoint saved ({len(cache)} entries)")

        time.sleep(REQUEST_PAUSE_SEC)

    save_cache(cache)
    print(f"\nRaw cache saved: {CACHE_PATH}")

    dataset = build_dataset(cache)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(dataset, indent=2), encoding="utf-8")
    award_season_count = sum(len(p["award_seasons"]) for p in dataset)
    print(f"Wrote {len(dataset)} notable players "
          f"({award_season_count} award seasons) -> {OUTPUT_PATH}")

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
