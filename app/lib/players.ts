// Pure game helpers. Keep this file free of data imports: it is bundled into
// the client, and players.json is large. Data is loaded in load-players.ts
// (server only) and passed down as props.

export type Player = {
  id: number;
  name: string;
  ppg: number;
};

export type Guess = "higher" | "lower";

export function headshotUrl(playerId: number): string {
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`;
}

export function isGuessCorrect(
  known: Player,
  revealed: Player,
  guess: Guess,
): boolean {
  return guess === "higher"
    ? revealed.ppg > known.ppg
    : revealed.ppg < known.ppg;
}

/**
 * The game needs at least two players with different PPG, otherwise no guess
 * has an answer. Check this before calling the pick functions below.
 */
export function hasEnoughPlayers(players: Player[]): boolean {
  return new Set(players.map((p) => p.ppg)).size >= 2;
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function pickStartingPair(players: Player[]): [Player, Player] {
  const first = randomItem(players);
  const second = randomItem(players.filter((p) => p.ppg !== first.ppg));
  return [first, second];
}

export function pickNextPlayer(
  players: Player[],
  seen: number[],
  current: Player,
): { next: Player; seen: number[] } {
  const eligible = (p: Player) => p.id !== current.id && p.ppg !== current.ppg;

  const seenIds = new Set(seen);
  let pool = players.filter((p) => eligible(p) && !seenIds.has(p.id));
  let nextSeen = seen;
  if (pool.length === 0) {
    pool = players.filter(eligible);
    nextSeen = [current.id];
  }
  const next = randomItem(pool);
  return { next, seen: [...nextSeen, next.id] };
}
