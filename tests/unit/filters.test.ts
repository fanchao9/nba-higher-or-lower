import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  buildEntries,
  clampSettings,
  orderedStats,
  seasonEndYear,
  yearBounds,
  type GameSettings,
} from "@/app/lib/filters";
import { STAT_KEYS } from "@/app/lib/stats";
import { player, season } from "./helpers";

const settings = (patch: Partial<GameSettings> = {}): GameSettings => ({
  seasonMode: false,
  yearFrom: 1947,
  yearTo: 2100,
  minAwardSeasons: 0,
  stats: ["ppg"],
  ...patch,
});

describe("seasonEndYear", () => {
  it("returns the calendar year a season ends in", () => {
    expect(seasonEndYear("1989-90")).toBe(1990);
    expect(seasonEndYear("1999-00")).toBe(2000);
    expect(seasonEndYear("2023-24")).toBe(2024);
  });

  it("returns null for anything that is not a season id", () => {
    expect(seasonEndYear("garbage")).toBeNull();
    expect(seasonEndYear("")).toBeNull();
  });
});

describe("yearBounds / clampSettings", () => {
  it("uses the earliest and latest season end years in the data", () => {
    const players = [
      player(1, { first: "1990-91", last: "1999-00" }),
      player(2, { first: "2005-06", last: "2024-25" }),
      player(3, { first: null, last: null }),
    ];
    expect(yearBounds(players)).toEqual({ min: 1991, max: 2025 });
  });

  it("falls back to a sensible range when there is no season data", () => {
    const bounds = yearBounds([player(1, { first: null, last: null })]);
    expect(bounds.min).toBe(1947);
    expect(bounds.max).toBeGreaterThanOrEqual(2025);
  });

  it("clamps the year range into the bounds and keeps it ordered", () => {
    const bounds = { min: 1947, max: 2027 };
    expect(clampSettings(settings({ yearFrom: 2005, yearTo: 9999 }), bounds)).toMatchObject({
      yearFrom: 2005,
      yearTo: 2027,
    });
    expect(clampSettings(settings({ yearFrom: 1800, yearTo: 1900 }), bounds)).toMatchObject({
      yearFrom: 1947,
      yearTo: 1947,
    });
    const reversed = clampSettings(settings({ yearFrom: 2020, yearTo: 2010 }), bounds);
    expect(reversed.yearTo).toBeGreaterThanOrEqual(reversed.yearFrom);
  });

  it("keeps the shipped defaults valid", () => {
    expect(DEFAULT_SETTINGS.stats.length).toBeGreaterThanOrEqual(1);
    for (const s of DEFAULT_SETTINGS.stats) expect(STAT_KEYS).toContain(s);
  });
});

describe("orderedStats", () => {
  it("returns selected stats in canonical order, without duplicates", () => {
    expect(orderedStats(["bpg", "ppg", "bpg", "apg"])).toEqual(["ppg", "apg", "bpg"]);
  });
});

describe("buildEntries: career mode", () => {
  const players = [
    player(1, { first: "1990-91", last: "1999-00" }),
    player(2, { first: "2010-11", last: "2019-20" }),
    player(3, { first: null, last: null }),
  ];
  const ids = (s: GameSettings) => buildEntries(players, s).map((e) => e.playerId);

  it("includes players whose careers overlap the year range", () => {
    expect(ids(settings({ yearFrom: 1995, yearTo: 2000 }))).toEqual([1]);
    expect(ids(settings({ yearFrom: 1999, yearTo: 2012 }))).toEqual([1, 2]);
    expect(ids(settings({ yearFrom: 2020, yearTo: 2100 }))).toEqual([2]);
  });

  it("excludes players that end before, or start after, the range", () => {
    expect(ids(settings({ yearFrom: 2001, yearTo: 2009 }))).toEqual([]);
  });

  it("excludes players with no season data when nothing can be checked", () => {
    expect(ids(settings())).not.toContain(3);
  });

  it("requires the minimum number of award seasons", () => {
    const decorated = [
      player(1, { seasons: [season("1995-96"), season("1996-97")] }),
      player(2, { seasons: [season("2012-13")] }),
      player(3, { seasons: [] }),
    ];
    const run = (min: number) =>
      buildEntries(decorated, settings({ minAwardSeasons: min })).map((e) => e.playerId);
    expect(run(0)).toEqual([1, 2, 3]);
    expect(run(1)).toEqual([1, 2]);
    expect(run(2)).toEqual([1]);
    expect(run(3)).toEqual([]);
  });

  it("drops players with no value for any selected stat", () => {
    const p = [
      player(1, { career: { ppg: 10, rpg: null } }),
      player(2, { career: { ppg: null, rpg: 5 } }),
    ];
    expect(buildEntries(p, settings({ stats: ["ppg"] })).map((e) => e.playerId)).toEqual([1]);
    expect(buildEntries(p, settings({ stats: ["ppg", "rpg"] })).map((e) => e.playerId)).toEqual([1, 2]);
  });

  it("builds entries with the career stats and shooting line", () => {
    const [e] = buildEntries([player(7, { career: { ppg: 22.5 } })], settings());
    expect(e).toMatchObject({ key: "7", playerId: 7, season: null, awards: [], stats: { ppg: 22.5 } });
    expect(e.shooting).toEqual({ fgPct: null, fg3Pct: null, ftPct: null });
  });
});

describe("buildEntries: season mode", () => {
  const p = player(1, {
    seasons: [
      season("2008-09", { ppg: 28.4 }, ["MVP", "ALL_NBA_1"]),
      season("2015-16", { ppg: 25.3 }, ["FMVP"]),
      season("2019-20", { ppg: null, rpg: 7 }, ["ALL_NBA_2"]),
    ],
  });

  it("includes only seasons that end inside the year range", () => {
    const got = buildEntries([p], settings({ seasonMode: true, yearFrom: 2010, yearTo: 2016 }));
    expect(got.map((e) => e.season)).toEqual(["2015-16"]);
    const one = buildEntries([p], settings({ seasonMode: true, yearFrom: 2009, yearTo: 2009 }));
    expect(one.map((e) => e.season)).toEqual(["2008-09"]);
  });

  it("builds one entry per season with a unique key, team and awards", () => {
    const got = buildEntries([p], settings({ seasonMode: true }));
    expect(got.map((e) => e.key)).toEqual(["1:2008-09", "1:2015-16"]);
    expect(got[0]).toMatchObject({
      playerId: 1,
      season: "2008-09",
      team: "AAA",
      awards: ["MVP", "ALL_NBA_1"],
    });
    expect(got[0].shooting.fgPct).toBe(0.5);
  });

  it("skips seasons with no value for any selected stat", () => {
    const withRpg = buildEntries([p], settings({ seasonMode: true, stats: ["ppg", "rpg"] }));
    expect(withRpg.map((e) => e.season)).toEqual(["2008-09", "2015-16", "2019-20"]);
  });

  it("counts all of a player's award seasons for the minimum, not just those in range", () => {
    const got = buildEntries(
      [p],
      settings({ seasonMode: true, yearFrom: 2015, yearTo: 2016, minAwardSeasons: 3 }),
    );
    expect(got.map((e) => e.season)).toEqual(["2015-16"]);
    expect(
      buildEntries([p], settings({ seasonMode: true, minAwardSeasons: 4 })),
    ).toEqual([]);
  });
});
