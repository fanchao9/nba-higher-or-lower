import { useSyncExternalStore } from "react";

export type ScoreMode = "career" | "season";

const KEY = "nba-higher-lower:best";
const CHANGE_EVENT = "best-score-change";

type Bests = Record<ScoreMode, number>;

const toScore = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;

function parse(raw: string): Bests {
  try {
    const data = JSON.parse(raw);
    return { career: toScore(data?.career), season: toScore(data?.season) };
  } catch {
    return { career: 0, season: 0 };
  }
}

function readRaw(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange); // other tabs
  window.addEventListener(CHANGE_EVENT, onChange); // this tab
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useBestScore(mode: ScoreMode): number {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "");
  return parse(raw)[mode];
}

export function readBestScore(mode: ScoreMode): number {
  return parse(readRaw())[mode];
}

export function recordScore(mode: ScoreMode, score: number): void {
  const bests = parse(readRaw());
  if (score <= bests[mode]) return;
  bests[mode] = score;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(bests));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
