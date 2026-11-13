// Server-side only: import this from Server Components (e.g. app/page.tsx),
// never from a "use client" file. players.json is large (it will also hold
// award_seasons), so only the fields the game needs are passed to the client.
import scraped from "@/app/data/players.json";
import type { Player } from "@/app/lib/players";

export function loadPlayers(): Player[] {
  return scraped.flatMap((p) =>
    // The scraper can emit null for a stat that was never tracked; skip those.
    typeof p.ppg === "number" && Number.isFinite(p.ppg)
      ? [{ id: p.id, name: p.name, ppg: p.ppg }]
      : [],
  );
}
