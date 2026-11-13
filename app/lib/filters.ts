import type { Player, PpgGap } from "@/app/lib/players";

export type Filters = {
  playedSince: number | null;
  minAwardSeasons: number;
  minCareerGames: number;
  ppgGap: PpgGap;
};


export const DEFAULT_FILTERS: Filters = {
  playedSince: 2023,
  minAwardSeasons: 1,
  minCareerGames: 0,
  ppgGap: { min: 0.2, max: 10 },
};

export function seasonEndYear(season: string): number | null {
  const start = Number.parseInt(season.slice(0, 4), 10);
  return Number.isFinite(start) ? start + 1 : null;
}

export function filterPlayers(players: Player[], filters: Filters): Player[] {
  const { playedSince, minAwardSeasons, minCareerGames } = filters;

  return players.filter((p) => {
    if (playedSince !== null) {
      const endYear = p.lastSeason ? seasonEndYear(p.lastSeason) : null;
      if (endYear === null || endYear < playedSince) return false;
    }
    if (minAwardSeasons > 0 && (p.awardSeasons ?? 0) < minAwardSeasons) {
      return false;
    }
    if (minCareerGames > 0 && (p.gp ?? 0) < minCareerGames) return false;
    return true;
  });
}
