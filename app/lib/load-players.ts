// Server-side only: import this from Server Components (e.g. app/page.tsx),
// never from a "use client" file. players.json is large, so only the fields
// the game needs are passed to the client.
import scraped from "@/app/data/players.json";
import type { PlayerRecord, SeasonRecord } from "@/app/lib/players";
import type { StatLine } from "@/app/lib/stats";

// Fields read from players.json. Older files may lack the season/award fields.
type RawStats = {
  ppg?: number | null;
  rpg?: number | null;
  apg?: number | null;
  spg?: number | null;
  bpg?: number | null;
};
type RawSeason = RawStats & {
  season: string;
  team?: string | null;
  awards?: string[];
};
type RawPlayer = RawStats & {
  id: number;
  name: string;
  first_season?: string | null;
  last_season?: string | null;
  award_seasons?: RawSeason[];
};

const num = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function statLine(raw: RawStats): StatLine {
  return {
    ppg: num(raw.ppg),
    rpg: num(raw.rpg),
    apg: num(raw.apg),
    spg: num(raw.spg),
    bpg: num(raw.bpg),
  };
}

export function loadPlayers(): PlayerRecord[] {
  return (scraped as RawPlayer[]).map((p) => ({
    id: p.id,
    name: p.name,
    firstSeason: p.first_season ?? null,
    lastSeason: p.last_season ?? null,
    career: statLine(p),
    seasons: (p.award_seasons ?? []).map(
      (s): SeasonRecord => ({
        season: s.season,
        team: s.team ?? null,
        awards: s.awards ?? [],
        stats: statLine(s),
      }),
    ),
  }));
}
