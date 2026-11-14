// The stats the game can compare, and the display names for awards.
// To add a stat: add it to StatKey, STATS and STAT_KEYS, then include it in
// the scraper output and in load-players.ts.

export type StatKey = "ppg" | "rpg" | "apg" | "spg" | "bpg";

// Allowed difference between the two values on screen.
export type StatGap = { min: number; max: number };

export type StatDef = {
  key: StatKey;
  label: string;
  short: string;
  gap: StatGap;
};

export const STATS: Record<StatKey, StatDef> = {
  ppg: { key: "ppg", label: "Points per game", short: "PPG", gap: { min: 0.2, max: 10 } },
  rpg: { key: "rpg", label: "Rebounds per game", short: "RPG", gap: { min: 0.3, max: 6 } },
  apg: { key: "apg", label: "Assists per game", short: "APG", gap: { min: 0.3, max: 4 } },
  spg: { key: "spg", label: "Steals per game", short: "SPG", gap: { min: 0.1, max: 1 } },
  bpg: { key: "bpg", label: "Blocks per game", short: "BPG", gap: { min: 0.1, max: 1.5 } },
};

export const STAT_KEYS: StatKey[] = ["ppg", "rpg", "apg", "spg", "bpg"];

export type StatLine = Record<StatKey, number | null>;

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
