import { PLACEHOLDER_PLAYERS } from "@/app/data/placeholder-players";

export type Player = {
  id: number;
  name: string;
  ppg: number;
};

export type Guess = "higher" | "lower";

export const PLAYERS: Player[] = PLACEHOLDER_PLAYERS;

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

  let pool = players.filter((p) => eligible(p) && !seen.includes(p.id));
  let nextSeen = seen;
  if (pool.length === 0) {
    pool = players.filter(eligible);
    nextSeen = [current.id];
  }
  const next = randomItem(pool);
  return { next, seen: [...nextSeen, next.id] };
}
