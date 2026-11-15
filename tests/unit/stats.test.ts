import { describe, expect, it } from "vitest";
import {
  DISPLAY_ROWS,
  STAT_KEYS,
  STATS,
  awardLabel,
  formatPct,
  formatStat,
} from "@/app/lib/stats";

describe("formatStat / formatPct", () => {
  it("formats per-game values to one decimal", () => {
    expect(formatStat(27.04)).toBe("27.0");
    expect(formatStat(0.86)).toBe("0.9");
    expect(formatStat(0)).toBe("0.0");
  });

  it("formats fractions as percentages to one decimal", () => {
    expect(formatPct(0.4893)).toBe("48.9%");
    expect(formatPct(0)).toBe("0.0%");
    expect(formatPct(1)).toBe("100.0%");
  });

  it("shows a dash for missing values", () => {
    expect(formatStat(null)).toBe("–");
    expect(formatPct(null)).toBe("–");
  });
});

describe("awardLabel", () => {
  it("maps every scraper award code to a readable label", () => {
    expect(awardLabel("MVP")).toBe("MVP");
    expect(awardLabel("FMVP")).toBe("Finals MVP");
    expect(awardLabel("6MOY")).toBe("6th Man");
    expect(awardLabel("ALL_NBA_1")).toBe("All-NBA 1st");
    expect(awardLabel("ALL_NBA_3")).toBe("All-NBA 3rd");
  });

  it("falls back to the raw code for unknown awards", () => {
    expect(awardLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });
});

describe("DISPLAY_ROWS (the 'show all stats' list)", () => {
  it("lists every stat then the three shooting percentages, in order", () => {
    expect(DISPLAY_ROWS.map((r) => r.label)).toEqual([
      "PPG",
      "RPG",
      "APG",
      "SPG",
      "BPG",
      "FG%",
      "3PT%",
      "FT%",
    ]);
  });

  it("starts with the comparable stats, in the same order as STAT_KEYS", () => {
    expect(DISPLAY_ROWS.slice(0, STAT_KEYS.length).map((r) => r.id)).toEqual(STAT_KEYS);
  });

  it("has a definition for every stat key", () => {
    for (const key of STAT_KEYS) expect(STATS[key].key).toBe(key);
  });
});
