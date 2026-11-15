import { vi } from "vitest";
import type { Entry, PlayerRecord, SeasonRecord } from "@/app/lib/players";
import type { ShootingLine, StatLine } from "@/app/lib/stats";

export const noStats = (): StatLine => ({
  ppg: null,
  rpg: null,
  apg: null,
  spg: null,
  bpg: null,
});

export const noShooting = (): ShootingLine => ({
  fgPct: null,
  fg3Pct: null,
  ftPct: null,
});

/** An entry whose stats are all null except the ones given. */
export function entry(
  id: number,
  stats: Partial<StatLine> = {},
  extra: Partial<Entry> = {},
): Entry {
  return {
    key: String(id),
    playerId: id,
    name: `Player ${id}`,
    season: null,
    team: null,
    awards: [],
    stats: { ...noStats(), ...stats },
    shooting: noShooting(),
    ...extra,
  };
}

export function season(
  label: string,
  stats: Partial<StatLine> = {},
  awards: string[] = ["ALL_NBA_1"],
): SeasonRecord {
  return {
    season: label,
    team: "AAA",
    awards,
    stats: { ...noStats(), ...stats },
    shooting: { fgPct: 0.5, fg3Pct: 0.35, ftPct: 0.8 },
  };
}

export function player(
  id: number,
  opts: {
    first?: string | null;
    last?: string | null;
    career?: Partial<StatLine>;
    seasons?: SeasonRecord[];
  } = {},
): PlayerRecord {
  return {
    id,
    name: `Player ${id}`,
    firstSeason: opts.first === undefined ? "2010-11" : opts.first,
    lastSeason: opts.last === undefined ? "2019-20" : opts.last,
    career: { ...noStats(), ppg: 10, ...opts.career },
    careerShooting: noShooting(),
    seasons: opts.seasons ?? [],
  };
}

/** Make Math.random deterministic (mulberry32). Restore with vi.restoreAllMocks(). */
export function seedRandom(seed: number): void {
  let a = seed >>> 0;
  vi.spyOn(Math, "random").mockImplementation(() => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
}
