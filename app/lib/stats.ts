// The stats the game can compare, and the display names for awards.
// To add a stat: add it to StatKey, STATS and STAT_KEYS, then include it in
// the scraper output and in load-players.ts.

export type StatKey = "ppg" | "rpg" | "apg" | "spg" | "bpg";

// Allowed difference between the two values on screen.
export type StatGap = { min: number; max: number };

export type StatDef = {
  key: StatKey;
  short: string;
  gap: StatGap;
};

export const STATS: Record<StatKey, StatDef> = {
  ppg: { key: "ppg", short: "PPG", gap: { min: 0.2, max: 10 } },
  rpg: { key: "rpg", short: "RPG", gap: { min: 0.3, max: 6 } },
  apg: { key: "apg", short: "APG", gap: { min: 0.3, max: 4 } },
  spg: { key: "spg", short: "SPG", gap: { min: 0.1, max: 1 } },
  bpg: { key: "bpg", short: "BPG", gap: { min: 0.1, max: 1.5 } },
};

export const STAT_KEYS: StatKey[] = ["ppg", "rpg", "apg", "spg", "bpg"];

export type StatLine = Record<StatKey, number | null>;

// Shooting percentages as fractions (0.489 = 48.9%)
export type ShootingKey = "fgPct" | "fg3Pct" | "ftPct";
export type ShootingLine = Record<ShootingKey, number | null>;

export type DisplayRow =
  | { id: StatKey; label: string; kind: "stat" }
  | { id: ShootingKey; label: string; kind: "pct" };

export const DISPLAY_ROWS: DisplayRow[] = [
  ...STAT_KEYS.map(
    (key): DisplayRow => ({ id: key, label: STATS[key].short, kind: "stat" }),
  ),
  { id: "fgPct", label: "FG%", kind: "pct" },
  { id: "fg3Pct", label: "3PT%", kind: "pct" },
  { id: "ftPct", label: "FT%", kind: "pct" },
];

export function formatStat(value: number | null): string {
  return value === null ? "–" : value.toFixed(1);
}

export function formatPct(value: number | null): string {
  return value === null ? "–" : `${(value * 100).toFixed(1)}%`;
}

const AWARD_LABELS: Record<string, string> = {
  MVP: "MVP",
  FMVP: "Finals MVP",
  DPOY: "DPOY",
  ROY: "ROY",
  MIP: "MIP",
  "6MOY": "6th Man",
  CPOY: "Clutch POY",
  ALL_NBA_1: "All-NBA 1st",
  ALL_NBA_2: "All-NBA 2nd",
  ALL_NBA_3: "All-NBA 3rd",
};

export function awardLabel(code: string): string {
  return AWARD_LABELS[code] ?? code;
}
