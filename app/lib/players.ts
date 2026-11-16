import {
  STATS,
  type ShootingLine,
  type StatKey,
  type StatLine,
} from "@/app/lib/stats";

export type SeasonRecord = {
  season: string;
  team: string | null;
  awards: string[];
  stats: StatLine;
  shooting: ShootingLine;
};

export type PlayerRecord = {
  id: number;
  name: string;
  firstSeason: string | null;
  lastSeason: string | null;
  career: StatLine;
  careerShooting: ShootingLine;
  seasons: SeasonRecord[];
  hasPhoto?: boolean;
};

export type Entry = {
  key: string;
  playerId: number;
  name: string;
  season: string | null;
  team: string | null;
  awards: string[];
  stats: StatLine;
  shooting: ShootingLine;
  hasPhoto?: boolean;
};

export type Guess = "higher" | "lower";

export function headshotUrl(playerId: number): string {
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`;
}

const SMALLEST_DIFF = 0.01;

const round2 = (n: number) => Math.round(n * 100) / 100;

function statDifference(a: Entry, b: Entry, stat: StatKey): number | null {
  const av = a.stats[stat];
  const bv = b.stats[stat];
  return av === null || bv === null ? null : round2(Math.abs(av - bv));
}

export function isValidPair(a: Entry, b: Entry, stat: StatKey): boolean {
  if (a.playerId === b.playerId) return false;
  const diff = statDifference(a, b, stat);
  if (diff === null) return false;
  const gap = STATS[stat].gap;
  return diff >= Math.max(gap.min, SMALLEST_DIFF) && diff <= gap.max;
}

export function isGuessCorrect(
  left: Entry,
  right: Entry,
  stat: StatKey,
  guess: Guess,
): boolean {
  const l = left.stats[stat];
  const r = right.stats[stat];
  if (l === null || r === null) return false;
  return guess === "higher" ? r > l : r < l;
}

export function hasEnoughEntries(entries: Entry[], stats: StatKey[]): boolean {
  return entries.some((a) =>
    entries.some((b) => stats.some((s) => isValidPair(a, b, s))),
  );
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function nearest(
  others: Entry[],
  current: Entry,
  stat: StatKey,
  minDiff: number,
): Entry[] {
  const scored = others.flatMap((e) => {
    const diff = statDifference(current, e, stat);
    return diff !== null && diff >= minDiff ? [{ e, diff }] : [];
  });
  if (scored.length === 0) return [];
  const best = Math.min(...scored.map((s) => s.diff));
  return scored.filter((s) => s.diff === best).map((s) => s.e);
}

export type Round = {
  left: Entry;
  right: Entry;
  stat: StatKey;
  seen: string[];
};

export function pickNextRound(
  entries: Entry[],
  stats: StatKey[],
  seen: string[],
  current: Entry,
): { stat: StatKey; next: Entry; seen: string[] } {
  const others = entries.filter((e) => e.playerId !== current.playerId);
  const seenKeys = new Set(seen);
  const order = shuffled(stats).filter((s) => current.stats[s] !== null);

  const pickValid = (skipSeen: boolean) => {
    for (const stat of order) {
      const pool = others.filter(
        (e) => isValidPair(current, e, stat) && !(skipSeen && seenKeys.has(e.key)),
      );
      if (pool.length > 0) return { stat, next: randomItem(pool) };
    }
    return null;
  };

  const pickNearest = (minDiff: (stat: StatKey) => number) => {
    for (const stat of order) {
      const pool = nearest(others, current, stat, minDiff(stat));
      if (pool.length > 0) return { stat, next: randomItem(pool) };
    }
    return null;
  };

  let nextSeen = seen;
  let hit = pickValid(true);
  if (!hit) {
    nextSeen = [current.key];
    hit = pickValid(false);
  }
  hit ??= pickNearest((s) => Math.max(STATS[s].gap.min, SMALLEST_DIFF));
  hit ??= pickNearest(() => SMALLEST_DIFF);
  if (!hit) throw new Error("pickNextRound: no entry with a different value");

  return { stat: hit.stat, next: hit.next, seen: [...nextSeen, hit.next.key] };
}

export function pickStartingRound(entries: Entry[], stats: StatKey[]): Round {
  const usable = entries.filter((e) => stats.some((s) => e.stats[s] !== null));
  let first = randomItem(usable);
  for (let i = 0; i < 40; i++) {
    const candidate = randomItem(usable);
    const hasPartner = usable.some((o) =>
      stats.some((s) => isValidPair(candidate, o, s)),
    );
    if (hasPartner) {
      first = candidate;
      break;
    }
  }
  const { stat, next, seen } = pickNextRound(entries, stats, [first.key], first);
  return { left: first, right: next, stat, seen };
}
