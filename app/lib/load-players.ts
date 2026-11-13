// Server-side only: import this from Server Components (e.g. app/page.tsx),
// never from a "use client" file. players.json is large (it holds
// award_seasons), so only the fields the game needs are passed to the client.
import scraped from "@/app/data/players.json";
import type { Player } from "@/app/lib/players";

// Fields read from players.json. Older files may lack the season/award fields.
type RawPlayer = {
  id: number;
  name: string;
  ppg: number | null;
  gp?: number;
  last_season?: string | null;
  award_seasons?: unknown[];
};

export function loadPlayers(): Player[] {
  return (scraped as RawPlayer[]).flatMap((p) =>
    // The scraper can emit null for a stat that was never tracked; skip those.
    typeof p.ppg === "number" && Number.isFinite(p.ppg)
      ? [
          {
            id: p.id,
            name: p.name,
            ppg: p.ppg,
            lastSeason: p.last_season ?? null,
            awardSeasons: p.award_seasons?.length ?? 0,
            gp: p.gp,
          },
        ]
      : [],
  );
}
