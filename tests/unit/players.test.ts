import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hasEnoughEntries,
  isGuessCorrect,
  isValidPair,
  pickNextRound,
  pickStartingRound,
  type Entry,
} from "@/app/lib/players";
import { STAT_KEYS, STATS, type StatKey } from "@/app/lib/stats";
import { entry, seedRandom } from "./helpers";

afterEach(() => vi.restoreAllMocks());

describe("isValidPair (the closeness rule)", () => {
  it("accepts values whose difference is inside the stat's gap", () => {
    expect(isValidPair(entry(1, { ppg: 20 }), entry(2, { ppg: 25 }), "ppg")).toBe(true);
  });

  it("treats the gap boundaries as inclusive, ignoring float noise", () => {
    expect(isValidPair(entry(1, { ppg: 24.7 }), entry(2, { ppg: 24.5 }), "ppg")).toBe(true);
    expect(isValidPair(entry(1, { ppg: 30.1 }), entry(2, { ppg: 20.1 }), "ppg")).toBe(true);
  });

  it("rejects pairs that are too close or too far apart", () => {
    expect(isValidPair(entry(1, { ppg: 24.7 }), entry(2, { ppg: 24.6 }), "ppg")).toBe(false);
    expect(isValidPair(entry(1, { ppg: 30.1 }), entry(2, { ppg: 20.0 }), "ppg")).toBe(false);
  });

  it("never allows a tie, even if the configured minimum were 0", () => {
    expect(isValidPair(entry(1, { ppg: 12 }), entry(2, { ppg: 12 }), "ppg")).toBe(false);
  });

  it("never pairs a player with themselves (two seasons of one player)", () => {
    const a = entry(1, { ppg: 10 }, { key: "1:2010-11" });
    const b = entry(1, { ppg: 20 }, { key: "1:2011-12" });
    expect(isValidPair(a, b, "ppg")).toBe(false);
  });

  it("rejects entries missing the stat", () => {
    expect(isValidPair(entry(1, { ppg: 10 }), entry(2, {}), "ppg")).toBe(false);
  });

  it("uses each stat's own gap", () => {
    // spg gap is 0.1 to 1
    expect(isValidPair(entry(1, { spg: 2 }), entry(2, { spg: 0.5 }), "spg")).toBe(false);
    expect(isValidPair(entry(1, { ppg: 2 }), entry(2, { ppg: 3.5 }), "ppg")).toBe(true);
  });
});

describe("isGuessCorrect", () => {
  const left = entry(1, { ppg: 20 });
  const higher = entry(2, { ppg: 25 });
  const lower = entry(3, { ppg: 15 });

  it("checks higher and lower guesses", () => {
    expect(isGuessCorrect(left, higher, "ppg", "higher")).toBe(true);
    expect(isGuessCorrect(left, higher, "ppg", "lower")).toBe(false);
    expect(isGuessCorrect(left, lower, "ppg", "lower")).toBe(true);
    expect(isGuessCorrect(left, lower, "ppg", "higher")).toBe(false);
  });

  it("is false when a value is missing", () => {
    expect(isGuessCorrect(left, entry(4, {}), "ppg", "higher")).toBe(false);
  });
});

describe("hasEnoughEntries", () => {
  it("is false for empty and single-entry pools", () => {
    expect(hasEnoughEntries([], ["ppg"])).toBe(false);
    expect(hasEnoughEntries([entry(1, { ppg: 10 })], ["ppg"])).toBe(false);
  });

  it("is false when every pair is a tie, too close, or too far", () => {
    expect(hasEnoughEntries([entry(1, { ppg: 5 }), entry(2, { ppg: 5 })], ["ppg"])).toBe(false);
    expect(hasEnoughEntries([entry(1, { ppg: 5 }), entry(2, { ppg: 5.1 })], ["ppg"])).toBe(false);
    expect(hasEnoughEntries([entry(1, { ppg: 5 }), entry(2, { ppg: 25 })], ["ppg"])).toBe(false);
  });

  it("only counts the selected stats", () => {
    const pool = [entry(1, { ppg: 5, rpg: 3 }), entry(2, { ppg: 5.1, rpg: 8 })];
    expect(hasEnoughEntries(pool, ["ppg"])).toBe(false);
    expect(hasEnoughEntries(pool, ["ppg", "rpg"])).toBe(true);
  });

  it("does not count two seasons of the same player as a pair", () => {
    const pool = [
      entry(1, { ppg: 10 }, { key: "1:a" }),
      entry(1, { ppg: 20 }, { key: "1:b" }),
    ];
    expect(hasEnoughEntries(pool, ["ppg"])).toBe(false);
  });
});

function spreadPool(n: number): Entry[] {
  return Array.from({ length: n }, (_, i) =>
    entry(i + 1, {
      ppg: 5 + i * 0.7,
      rpg: 2 + i * 0.5,
      apg: 1 + i * 0.4,
      spg: i % 4 === 0 ? null : 0.5 + (i % 7) * 0.2,
      bpg: i % 5 === 0 ? null : 0.3 + (i % 6) * 0.25,
    }),
  );
}

describe("pickNextRound", () => {
  it("always returns a valid pair for a selected stat, never the same player", () => {
    seedRandom(1);
    const pool = spreadPool(60);
    let current = pool[0];
    let seen = [current.key];
    for (let i = 0; i < 400; i++) {
      const res = pickNextRound(pool, STAT_KEYS, seen, current);
      expect(STAT_KEYS).toContain(res.stat);
      expect(res.next.playerId).not.toBe(current.playerId);
      expect(isValidPair(current, res.next, res.stat)).toBe(true);
      current = res.next;
      seen = res.seen;
    }
  });

  it("does not repeat an entry until the pool is used up", () => {
    seedRandom(2);
    const pool = Array.from({ length: 8 }, (_, i) => entry(i + 1, { ppg: i * 3 }));
    let current = pool[0];
    let seen = [current.key];
    const shown = new Set([current.key]);
    for (let i = 0; i < 7; i++) {
      const res = pickNextRound(pool, ["ppg"], seen, current);
      expect(shown.has(res.next.key)).toBe(false);
      shown.add(res.next.key);
      current = res.next;
      seen = res.seen;
    }
    expect(shown.size).toBe(8);
  });

  it("starts over instead of failing when everything has been seen", () => {
    seedRandom(3);
    const pool = [entry(1, { ppg: 10 }), entry(2, { ppg: 16 }), entry(3, { ppg: 22 })];
    let current = pool[0];
    let seen = [current.key];
    for (let i = 0; i < 50; i++) {
      const res = pickNextRound(pool, ["ppg"], seen, current);
      expect(isValidPair(current, res.next, "ppg")).toBe(true);
      current = res.next;
      seen = res.seen;
    }
  });

  it("falls back to the closest entry when the current one has no valid partner", () => {
    const outlier = entry(1, { ppg: 35 });
    const pool = [outlier, entry(2, { ppg: 20 }), entry(3, { ppg: 24 }), entry(4, { ppg: 22 })];
    const res = pickNextRound(pool, ["ppg"], [outlier.key], outlier);
    expect(res.next.stats.ppg).toBe(24);
  });

  it("only uses stats the current entry has", () => {
    seedRandom(4);
    const current = entry(1, { ppg: 10 });
    const pool = [current, entry(2, { ppg: 15, rpg: 5 }), entry(3, { ppg: 18, rpg: 9 })];
    for (let i = 0; i < 30; i++) {
      expect(pickNextRound(pool, ["ppg", "rpg"], [current.key], current).stat).toBe("ppg");
    }
  });

  it("picks among all selected stats, not just the first", () => {
    seedRandom(5);
    const pool = spreadPool(60);
    const used = new Set<StatKey>();
    for (let i = 0; i < 100; i++) {
      used.add(pickNextRound(pool, ["ppg", "rpg", "apg"], [pool[10].key], pool[10]).stat);
    }
    expect(used).toEqual(new Set(["ppg", "rpg", "apg"]));
  });

  it("throws if nobody differs from the current entry", () => {
    const pool = [entry(1, { ppg: 10 }), entry(2, { ppg: 10 })];
    expect(() => pickNextRound(pool, ["ppg"], [pool[0].key], pool[0])).toThrow();
  });
});

describe("pickStartingRound", () => {
  it("returns two different players with a valid pair and both marked as seen", () => {
    seedRandom(6);
    const pool = spreadPool(40);
    for (let i = 0; i < 50; i++) {
      const round = pickStartingRound(pool, STAT_KEYS);
      expect(round.left.playerId).not.toBe(round.right.playerId);
      expect(isValidPair(round.left, round.right, round.stat)).toBe(true);
      expect(round.seen).toEqual(expect.arrayContaining([round.left.key, round.right.key]));
    }
  });
});

describe("stat gaps", () => {
  it("are positive and ordered for every stat", () => {
    for (const key of STAT_KEYS) {
      const { min, max } = STATS[key].gap;
      expect(min).toBeGreaterThan(0);
      expect(max).toBeGreaterThan(min);
    }
  });
});
