# NBA Higher or Lower

A guessing game built with Next.js. Two NBA players (or two of their seasons) sit side by side. The left card shows a stat, the right card hides it. Guess whether the hidden number is **higher** or **lower**. Get it right and the right card slides left to become the new known value, with a new challenger fading in on the right. Get it wrong and the run ends.

The data (about 1,100 players with 500+ career games, plus their award-winning seasons) comes from stats.nba.com. A local Python script collects it into a static `app/data/players.json`, so the site needs no backend or API at runtime.

## How it plays

- **Stats:** PPG, RPG, APG, SPG and BPG. Each round compares one of the stats you have checked, chosen at random.
- **Career mode (default):** compares career averages.
- **Season mode:** compares award-winning seasons (MVP, Finals MVP, DPOY, ROY, MIP, 6th Man, Clutch POY, All-NBA), for example one MVP year against another.
- **Pairings are fair:** two cards are only paired when their values differ by a sensible amount (for PPG, between 0.2 and 10). A tie never happens, and the same player never appears on both sides.
- **Show all stats:** the toggle under the question lists PPG, RPG, APG, SPG, BPG, FG%, 3PT% and FT% on each card. Only the stat being compared is hidden (`??`) on the right card. The cards grow and shrink smoothly when you switch.
- **Keyboard:** `↑` or `H` guesses higher, `↓` or `L` guesses lower. The shortcuts pause while the settings menu is open.
- **Best score:** saved in your browser (`localStorage`), separately for career and season mode.
- **Settings menu:** the button in the top right opens a menu with:
  - a **Compare seasons** switch
  - a two-handle **year range** slider (by the year a season ends, so 2024 means 2023-24)
  - a **minimum award seasons** slider, which keeps out obscure players
  - **stat checkboxes** (at least one stays checked)

  A live count shows how many players or seasons match. **GO** applies the settings and starts a new game.

## Getting started

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). A production build is `npm run build` then `npm start`.

The repo includes a generated `app/data/players.json`, so the game works right after install. Player photos load from `cdn.nba.com` (allowed in `next.config.ts`). The NBA has no photo for roughly half of the players (mostly older ones) and serves one generic silhouette for them, so those cards show the player's initials over a half-court drawing instead. The scraper records which players have a photo.

## Updating the data

The scraper runs on your own machine because stats.nba.com throttles fast requests and blocks many cloud IPs.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# Quick test on a few players (this overwrites players.json):
.\.venv\Scripts\python.exe scripts\scrape_players.py --limit 25

# Full run. Use --resume every time so an interrupted run continues:
.\.venv\Scripts\python.exe scripts\scrape_players.py --resume
```

On macOS or Linux, use `.venv/bin/python` instead.

| Stage | What it fetches | Time |
|---|---|---|
| 1 | Career totals and every season's stat line, for all ~5,200 players | about 85 min |
| 2 | Career FG%, 3P% and FT% for caches built before those fields existed (one time only) | about 20 min |
| 3 | Awards, only for players with 500+ career games | about 20 min |
| 4 | Which of those players have a real photo on `cdn.nba.com` (cheap HEAD requests) | about 1 min |

- **Interrupting:** press Ctrl+C at any time. Progress is cached in `scripts/.cache_career.json` (gitignored) and saved every 20 players, so you lose at most 19. Re-run with `--resume` to continue.
- **Output:** `app/data/players.json` is written only when every stage finishes, so an interrupted run leaves the old file untouched.
- **Averages:** per-game averages for steals and blocks are computed only over seasons where the NBA tracked them (steals and blocks start in 1973-74). Untracked values are `null`, and the game skips a player for a stat they have no value for.
- **Flags:** `--limit N` for the first N players, `--active-only` for current players only, `--resume` to skip anything already cached.
- **Tuning:** `MIN_CAREER_GP`, `REQUEST_PAUSE_SEC`, `AWARD_CODES` and the other knobs sit at the top of `scripts/scrape_players.py`.

`scripts/spike_one_player.py` is a one-off script that prints one player's raw API response. It's useful for exploring the data and isn't part of the pipeline.

## Customizing

| To change | Edit |
|---|---|
| Default settings (era, minimum awards, stats, mode) | `DEFAULT_SETTINGS` in `app/lib/filters.ts` |
| How close two values must be, per stat | `STATS[...].gap` in `app/lib/stats.ts` (the rule itself is `isValidPair` in `app/lib/players.ts`) |
| Which awards count as "notable" | `AWARD_CODES` and `AWARD_ORDER` in `scripts/scrape_players.py`, plus labels in `app/lib/stats.ts` |
| Animation timing | `COUNT_MS`, `RESULT_PAUSE_MS`, `SLIDE_MS` in `app/components/GameBoard.tsx`, and the keyframes in `app/globals.css` |
| Colors | the CSS variables at the top of `app/globals.css` |

## Project layout

```
app/
  page.tsx               loads players.json on the server and renders <Game>
  components/
    Game.tsx             holds the applied settings; remounts the board on GO / Play again
    GameBoard.tsx        round flow, animations, score
    PlayerCard.tsx       one card: photo, name, stat block or full stat list
    SettingsMenu.tsx     the settings dialog
    Switch.tsx           toggle switch used in both places
  lib/
    players.ts           types, the closeness rule, round picking (pure logic)
    filters.ts           settings type, defaults, building the card pool
    stats.ts             stat definitions, per-stat gaps, number formatting
    load-players.ts      reads players.json (server only)
    best-score.ts        best score in localStorage
  data/players.json      scraper output
scripts/
  scrape_players.py      builds players.json
tests/
  unit/                  Vitest unit tests
  e2e/                   Playwright browser tests
```

`app/lib/players.ts`, `filters.ts` and `stats.ts` are plain TypeScript with no React or data imports. They are bundled into the browser, which is why `players.json` is loaded in a Server Component and only the fields the game needs are passed down.

This project uses Next.js 16 with React 19 and Tailwind 4. Next.js 16 has breaking changes from earlier versions, so check `node_modules/next/dist/docs/` before changing framework-level code (see `AGENTS.md`).

## Testing

| What | Command | Covers |
|---|---|---|
| Lint, types, unit tests | `npm run check` | everything except the browser tests |
| Unit tests | `npm test` (`npm run test:watch` while coding) | `tests/unit`: pairing rules, filters, formatting, `players.json` contract |
| Browser tests | `npm run test:e2e` | `tests/e2e`: settings, GO, show-all-stats, guess flow |

The browser tests need a browser installed once:

```bash
npx playwright install chromium
```

If Chromium can't be downloaded, set `PLAYWRIGHT_CHANNEL=msedge` (or `chrome`) to use an installed browser.

## Deploying

The app deploys to [Vercel](https://vercel.com) with no configuration: the page is prerendered and the data ships with it. Vercel only runs `next build`, not the tests, so run `npm run check` before pushing.
