// Game settings: what the settings menu edits.
import type { Entry, PlayerRecord } from "@/app/lib/players";
import { STAT_KEYS, type StatKey } from "@/app/lib/stats";

export type GameSettings = {
  seasonMode: boolean;
  yearFrom: number;
  yearTo: number;
  minAwardSeasons: number;
  stats: StatKey[];
};

// Defaults
export const DEFAULT_SETTINGS: GameSettings = {
  seasonMode: false,
  yearFrom: 2005,
  yearTo: 9999,
  minAwardSeasons: 1,
  stats: ["ppg"],
};

export type YearBounds = { min: number; max: number };

// "1989-90" -> 1990. Returns null if the string isn't a season id.
export function seasonEndYear(season: string): number | null {
  const start = Number.parseInt(season.slice(0, 4), 10);
  return Number.isFinite(start) ? start + 1 : null;
}

export function yearBounds(players: PlayerRecord[]): YearBounds {
  let min = Infinity;
  let max = -Infinity;
  for (const p of players) {
    const first = p.firstSeason ? seasonEndYear(p.firstSeason) : null;
    const last = p.lastSeason ? seasonEndYear(p.lastSeason) : null;
    if (first !== null) min = Math.min(min, first);
    if (last !== null) max = Math.max(max, last);
  }
  return Number.isFinite(min) && Number.isFinite(max)
    ? { min, max }
    : { min: 1947, max: new Date().getFullYear() + 1 };
}

// Keep the year range inside the data and in order.
export function clampSettings(
  settings: GameSettings,
  bounds: YearBounds,
): GameSettings {
  const clamp = (n: number) => Math.min(bounds.max, Math.max(bounds.min, n));
  const yearFrom = clamp(settings.yearFrom);
  const yearTo = Math.max(yearFrom, clamp(settings.yearTo));
  return { ...settings, yearFrom, yearTo };
}

export function buildEntries(
  players: PlayerRecord[],
  settings: GameSettings,
): Entry[] {
  const { seasonMode, yearFrom, yearTo, minAwardSeasons, stats } = settings;
  const usable = (line: Entry["stats"]) => stats.some((s) => line[s] !== null);
  const out: Entry[] = [];

  for (const p of players) {
    if (p.seasons.length < minAwardSeasons) continue;

    if (seasonMode) {
      for (const s of p.seasons) {
        const end = seasonEndYear(s.season);
        if (end === null || end < yearFrom || end > yearTo) continue;
        if (!usable(s.stats)) continue;
        out.push({
          key: `${p.id}:${s.season}`,
          playerId: p.id,
          name: p.name,
          season: s.season,
          team: s.team,
          awards: s.awards,
          stats: s.stats,
          shooting: s.shooting,
        });
      }
    } else {
      const first = p.firstSeason ? seasonEndYear(p.firstSeason) : null;
      const last = p.lastSeason ? seasonEndYear(p.lastSeason) : null;
      if (first === null || last === null) continue;
      if (last < yearFrom || first > yearTo) continue;
      if (!usable(p.career)) continue;
      out.push({
        key: String(p.id),
        playerId: p.id,
        name: p.name,
        season: null,
        team: null,
        awards: [],
        stats: p.career,
        shooting: p.careerShooting,
      });
    }
  }
  return out;
}

export function orderedStats(selected: Iterable<StatKey>): StatKey[] {
  const set = new Set(selected);
  return STAT_KEYS.filter((k) => set.has(k));
}
