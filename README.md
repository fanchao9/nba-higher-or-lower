# NBA Higher or Lower

A guessing game about NBA stats. Two players sit side by side. You can see one stat for the player on the left, and you guess whether the player on the right has a higher or lower number. Get it right and the cards slide over for the next matchup. Get it wrong and your run is over.

Play it here: https://nba-higher-or-lower-lac.vercel.app

## How it works

- By default you compare career averages: PPG, RPG, APG, SPG and BPG. Each round picks one of the stats you have turned on.
- Season mode compares award-winning seasons instead, like one MVP year against another.
- Matchups are never ties, and the two numbers are always close enough to make a real guess (for PPG, within 10 points of each other).
- **Show all stats** lists PPG, RPG, APG, SPG, BPG, FG%, 3PT% and FT% on each card, with only the one you are guessing hidden.
- Keyboard: `↑` or `H` for higher, `↓` or `L` for lower.
- Your best score is saved in your browser, separately for career and season mode.
- The Settings button lets you change the stats, the years, the minimum number of award seasons (handy for keeping out obscure players) and season mode. **GO** starts a fresh game with your choices.
- Some players, mostly older ones, have no photo on the NBA's site. They show their initials instead of the league's grey silhouette.

## Run it locally

You need Node 20.9 or newer.

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). There's no backend. All the data lives in `app/data/players.json`, which is committed, so it works right after install.

## Refreshing the data

`players.json` comes from stats.nba.com through a Python script. Run it on your own machine, because the NBA throttles fast requests and blocks most cloud IPs.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe scripts\scrape_players.py --resume
```

On macOS or Linux, use `.venv/bin/python` instead.

- A full first run takes about two hours. You can stop it with Ctrl+C whenever you like and run it again with `--resume` to pick up where it left off. Progress is cached in `scripts/.cache_career.json`, which is gitignored.
- `players.json` is only written at the very end, so a stopped run leaves the current file alone.
- `--limit 25` is a quick test run. It overwrites `players.json`, so don't commit the result.
- The NBA didn't track steals and blocks before 1973-74, so those stats are blank for older players, and the game skips them when that stat comes up.
- Settings like `MIN_CAREER_GP` (500 games) and `AWARD_CODES` sit at the top of the script.
- `scripts/spike_one_player.py` is a throwaway script for poking at the API. The game doesn't use it.

## Tweaking things

- Default settings: `DEFAULT_SETTINGS` in `app/lib/filters.ts`
- How close two numbers have to be, per stat: `gap` in `app/lib/stats.ts`
- Animation timing: the constants at the top of `app/components/GameBoard.tsx` and the keyframes in `app/globals.css`
- Colors: the CSS variables at the top of `app/globals.css`

## Where things live

- `app/page.tsx` loads the data and renders the game.
- `app/components/` is the UI: `Game`, `GameBoard`, `PlayerCard` and `SettingsMenu`.
- `app/lib/` holds the rules: pairing (`players.ts`), settings and filtering (`filters.ts`), stat definitions (`stats.ts`), reading the data (`load-players.ts`) and the saved best score (`best-score.ts`). It's plain TypeScript with no React, which keeps it easy to test.
- `scripts/scrape_players.py` builds the data.
- `tests/` has the unit and browser tests.

This runs on Next.js 16, which differs a lot from older versions. If you're changing framework-level code, check `node_modules/next/dist/docs/` first (see `AGENTS.md`).

## Tests

```bash
npm run check       # lint, type check and unit tests
npm run test:e2e    # browser tests
```

The browser tests need a browser installed once: `npx playwright install chromium`. If that doesn't work, set `PLAYWRIGHT_CHANNEL=msedge` to use Edge instead.
