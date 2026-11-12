r"""
Spike: pull ONE player's career stats to confirm the nba_api data shape.

Run from the repo root with the venv Python:
    .\.venv\Scripts\python.exe scripts\spike_one_player.py

This hits stats.nba.com, so it must run on your local machine (cloud IPs are
blocked). If it hangs, stats.nba.com is rate-limiting you — wait and retry.
"""

from nba_api.stats.static import players
from nba_api.stats.endpoints import playercareerstats
import pandas as pd

pd.set_option("display.max_columns", None)
pd.set_option("display.width", 200)


def main() -> None:
    # 1. Find LeBron in the static (bundled, offline) player list.
    matches = players.find_players_by_full_name("LeBron James")
    print(f"Static lookup matches: {len(matches)}")
    lebron = matches[0]
    print("Player record:", lebron)
    player_id = lebron["id"]

    # 2. Pull career stats from the live endpoint.
    #    stats.nba.com is picky: it needs browser-like headers and will hang
    #    without a timeout. 30s is generous; if it still times out, retry.
    print("\nHitting stats.nba.com (this can take a few seconds)...")
    career = playercareerstats.PlayerCareerStats(
        player_id=player_id,
        timeout=30,
    )

    # The endpoint returns several named result sets. The two we care about:
    #   SeasonTotalsRegularSeason  -> one row per season (counting totals)
    #   CareerTotalsRegularSeason  -> a single career-totals row
    season = career.season_totals_regular_season.get_data_frame()
    career_totals = career.career_totals_regular_season.get_data_frame()

    print("\n=== Available result set columns (season totals) ===")
    print(list(season.columns))

    print("\n=== LeBron season totals (regular season) ===")
    print(season[["SEASON_ID", "TEAM_ABBREVIATION", "GP", "MIN", "PTS", "REB", "AST", "STL", "BLK"]])

    print("\n=== LeBron CAREER totals (regular season) ===")
    print(career_totals[["GP", "MIN", "PTS", "REB", "AST", "STL", "BLK"]])

    # 3. Compute the per-game rate stats we'll show in the game.
    row = career_totals.iloc[0]
    gp = row["GP"]
    print("\n=== Derived career per-game averages ===")
    print(f"PPG: {row['PTS'] / gp:.1f}")
    print(f"RPG: {row['REB'] / gp:.1f}")
    print(f"APG: {row['AST'] / gp:.1f}")
    print(f"SPG: {row['STL'] / gp:.1f}")
    print(f"BPG: {row['BLK'] / gp:.1f}")


if __name__ == "__main__":
    main()
