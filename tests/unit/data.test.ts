// Contract tests for app/data/players.json (the scraper's output) as the app
// reads it. These catch a bad scrape or a scraper/app mismatch before deploy.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  buildEntries,
  clampSettings,
  seasonEndYear,
  yearBounds,
} from "@/app/lib/filters";
import { loadPlayers } from "@/app/lib/load-players";
import { hasEnoughEntries } from "@/app/lib/players";
import { STAT_KEYS } from "@/app/lib/stats";

const players = loadPlayers();
const SEASON = /^\d{4}-\d{2}$/;
const isNullOrFinite = (v: number | null) => v === null || Number.isFinite(v);

describe("players.json as loaded by the app", () => {
  it("has players with unique ids and names", () => {
    expect(players.length).toBeGreaterThan(0);
    expect(new Set(players.map((p) => p.id)).size).toBe(players.length);
    for (const p of players) expect(p.name.length).toBeGreaterThan(0);
  });

  it("has only finite numbers or null in every stat (no NaN)", () => {
    for (const p of players) {
      for (const key of STAT_KEYS) {
        expect(isNullOrFinite(p.career[key]), `${p.name} career ${key}`).toBe(true);
        for (const s of p.seasons) {
          expect(isNullOrFinite(s.stats[key]), `${p.name} ${s.season} ${key}`).toBe(true);
        }
      }
      for (const v of Object.values(p.careerShooting)) {
        expect(isNullOrFinite(v), `${p.name} career shooting`).toBe(true);
        if (v !== null) expect(v).toBeGreaterThanOrEqual(0);
        if (v !== null) expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("has well-formed first/last seasons in order", () => {
    for (const p of players) {
      expect(p.firstSeason, p.name).toMatch(SEASON);
      expect(p.lastSeason, p.name).toMatch(SEASON);
      expect(p.firstSeason! <= p.lastSeason!, `${p.name} first <= last`).toBe(true);
    }
  });

  it("has award seasons that are well-formed, sorted and inside the career", () => {
    for (const p of players) {
      const labels = p.seasons.map((s) => s.season);
      expect(labels, p.name).toEqual([...labels].sort());
      for (const s of p.seasons) {
        expect(s.season, p.name).toMatch(SEASON);
        expect(s.awards.length, `${p.name} ${s.season}`).toBeGreaterThan(0);
        expect(s.season >= p.firstSeason! && s.season <= p.lastSeason!, `${p.name} ${s.season}`).toBe(true);
      }
    }
  });

  it("has usable data for each comparable stat", () => {
    for (const key of STAT_KEYS) {
      const withValue = players.filter((p) => p.career[key] !== null).length;
      expect(withValue, key).toBeGreaterThan(players.length / 2);
    }
  });
});

describe("the default game on the shipped data", () => {
  const bounds = yearBounds(players);
  const settings = clampSettings(DEFAULT_SETTINGS, bounds);

  it("is playable in career mode", () => {
    const entries = buildEntries(players, settings);
    expect(entries.length).toBeGreaterThanOrEqual(10);
    expect(hasEnoughEntries(entries, settings.stats)).toBe(true);
  });

  it("is playable in season mode", () => {
    const entries = buildEntries(players, { ...settings, seasonMode: true });
    expect(entries.length).toBeGreaterThanOrEqual(10);
    expect(hasEnoughEntries(entries, settings.stats)).toBe(true);
  });

  it("covers a sensible year range", () => {
    expect(bounds.min).toBeLessThan(bounds.max);
    expect(seasonEndYear(`${bounds.max - 1}-${String(bounds.max).slice(2)}`)).toBe(bounds.max);
  });
});
