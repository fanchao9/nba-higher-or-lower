// Pure game helpers. Keep this file free of data imports: it is bundled into
// the client, and players.json is large. Data is loaded in load-players.ts
// (server only) and passed down as props.

export type Player = {
  id: number;
  name: string;
  ppg: number;
  lastSeason?: string | null;
  awardSeasons?: number;
  gp?: number;
};

export type Guess = "higher" | "lower";

export type PpgGap = { min: number; max: number };

const SMALLEST_DIFF = 0.01;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function ppgDifference(a: Player, b: Player): number {
  return round2(Math.abs(a.ppg - b.ppg));
}

export function isValidPair(a: Player, b: Player, gap: PpgGap): boolean {
  if (a.id === b.id) return false;
  const diff = ppgDifference(a, b);
  return diff >= Math.max(gap.min, SMALLEST_DIFF) && diff <= gap.max;
}

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

export function hasEnoughPlayers(players: Player[], gap: PpgGap): boolean {
  const minDiff = Math.max(gap.min, SMALLEST_DIFF);
  const ppgs = players.map((p) => p.ppg).sort((x, y) => x - y);
  let j = 0;
  for (let i = 0; i < ppgs.length; i++) {
    if (j <= i) j = i + 1;
    // Smallest partner at or above the minimum gap; it only moves forward.
    while (j < ppgs.length && round2(ppgs[j] - ppgs[i]) < minDiff) j++;
    if (j < ppgs.length && round2(ppgs[j] - ppgs[i]) <= gap.max) return true;
  }
  return false;
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// Players (other than `current`) whose PPG is closest to it, at least `minDiff` away.
function nearest(others: Player[], current: Player, minDiff: number): Player[] {
  const candidates = others.filter((p) => ppgDifference(current, p) >= minDiff);
  if (candidates.length === 0) return [];
  const best = Math.min(...candidates.map((p) => ppgDifference(current, p)));
  return candidates.filter((p) => ppgDifference(current, p) === best);
}

export function pickStartingPair(
  players: Player[],
  gap: PpgGap,
): [Player, Player] {
  // Prefer a first player who has at least one valid partner.
  const withPartner = players.filter((p) =>
    players.some((q) => isValidPair(p, q, gap)),
  );
  const first = randomItem(withPartner.length > 0 ? withPartner : players);
  const { next } = pickNextPlayer(players, [first.id], first, gap);
  return [first, next];
}

/**
 * Next Player Preference order:
 *   1. valid pair (see isValidPair) and not shown yet this run
 *   2. valid pair, with the "already shown" list starting over
 *   3. fallback when `current` has no valid partner at all (e.g. an outlier
 *      scorer): the closest player at least the minimum gap away, then the
 *      closest non-tied player
 */
export function pickNextPlayer(
  players: Player[],
  seen: number[],
  current: Player,
  gap: PpgGap,
): { next: Player; seen: number[] } {
  const others = players.filter((p) => p.id !== current.id);
  const seenIds = new Set(seen);
  const valid = (p: Player) => isValidPair(current, p, gap);

  let pool = others.filter((p) => valid(p) && !seenIds.has(p.id));
  let nextSeen = seen;
  if (pool.length === 0) {
    nextSeen = [current.id];
    pool = others.filter(valid);
  }
  if (pool.length === 0) {
    pool = nearest(others, current, Math.max(gap.min, SMALLEST_DIFF));
  }
  if (pool.length === 0) {
    pool = nearest(others, current, SMALLEST_DIFF);
  }
  if (pool.length === 0) {
    throw new Error("pickNextPlayer: no player with a different PPG");
  }
  const next = randomItem(pool);
  return { next, seen: [...nextSeen, next.id] };
}
