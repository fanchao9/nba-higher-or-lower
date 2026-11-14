"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import PlayerCard, { type StatTone } from "@/app/components/PlayerCard";
import type { GameSettings } from "@/app/lib/filters";
import {
  hasEnoughEntries,
  isGuessCorrect,
  pickNextRound,
  pickStartingRound,
  type Entry,
  type Guess,
  type Round,
} from "@/app/lib/players";
import { STATS } from "@/app/lib/stats";

type Phase = "guessing" | "counting" | "result" | "sliding" | "gameover";

const COUNT_MS = 1600;
const RESULT_PAUSE_MS = 900;
const SLIDE_MS = 650;

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type GameBoardProps = {
  entries: Entry[];
  settings: GameSettings;
  onOpenSettings: () => void;
  onNewGame: () => void;
};

export default function GameBoard({
  entries,
  settings,
  onOpenSettings,
  onNewGame,
}: GameBoardProps) {
  const { stats, seasonMode } = settings;
  const enough = useMemo(
    () => hasEnoughEntries(entries, stats),
    [entries, stats],
  );
  const [round, setRound] = useState<Round | null>(null);
  const [phase, setPhase] = useState<Phase>("guessing");
  const [guess, setGuess] = useState<Guess | null>(null);
  const [score, setScore] = useState(0);
  const [displayValue, setDisplayValue] = useState(0);
  const [slideDx, setSlideDx] = useState(0);
  const arenaRef = useRef<HTMLElement>(null);

  const correct =
    round && guess
      ? isGuessCorrect(round.left, round.right, round.stat, guess)
      : null;

  // Random picks must not run during server prerender, so start on the client.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only random init
    if (enough) setRound(pickStartingRound(entries, stats));
  }, [entries, stats, enough]);

  // counting: animate the right card's value from 0 up to the real number,
  // easing out so it slows as it approaches the target.
  useEffect(() => {
    if (phase !== "counting" || !round || !guess) return;

    const target = round.right.stats[round.stat] ?? 0;
    const duration = prefersReducedMotion() ? 0 : COUNT_MS;
    const wasCorrect = isGuessCorrect(
      round.left,
      round.right,
      round.stat,
      guess,
    );
    const startedAt = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration);
      setDisplayValue(target * easeOutQuart(t));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        if (wasCorrect) setScore((s) => s + 1);
        setPhase("result");
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, round, guess]);

  // result: hold on the green/red value briefly, then slide on or end the game.
  useEffect(() => {
    if (phase !== "result") return;

    const timer = setTimeout(() => {
      if (!correct) {
        setPhase("gameover");
        return;
      }
      // Distance from the right card to the left slot, measured at slide start
      // so it stays correct if the window was resized.
      const arena = arenaRef.current;
      const leftEl = arena?.querySelector<HTMLElement>('[data-slot="left"]');
      const rightEl = arena?.querySelector<HTMLElement>('[data-slot="right"]');
      if (leftEl && rightEl) {
        setSlideDx(
          rightEl.getBoundingClientRect().left -
            leftEl.getBoundingClientRect().left,
        );
      }
      setPhase("sliding");
    }, RESULT_PAUSE_MS);

    return () => clearTimeout(timer);
  }, [phase, correct]);

  // sliding: once the slide/fade finishes, promote the right card to the left
  // slot and mount a new right card (which fades in on mount). The next
  // round may use a different stat.
  useEffect(() => {
    if (phase !== "sliding" || !round) return;

    const timer = setTimeout(() => {
      const { stat, next, seen } = pickNextRound(
        entries,
        stats,
        round.seen,
        round.right,
      );
      setRound({ left: round.right, right: next, stat, seen });
      setGuess(null);
      setDisplayValue(0);
      setSlideDx(0);
      setPhase("guessing");
    }, SLIDE_MS);

    return () => clearTimeout(timer);
  }, [phase, round, entries, stats]);

  function handleGuess(choice: Guess) {
    if (phase !== "guessing") return;
    setGuess(choice);
    setDisplayValue(0);
    setPhase("counting");
  }

  const canGuess = phase === "guessing";
  const revealed = phase !== "guessing";
  const rightTone: StatTone =
    phase === "result" || phase === "sliding" || phase === "gameover"
      ? correct
        ? "correct"
        : "wrong"
      : "neutral";

  const stat = round?.stat ?? stats[0];
  const statDef = STATS[stat];
  const statLabel = `${seasonMode ? "Season" : "Career"} ${statDef.short}`;
  const format = (v: number | null) => (v === null ? "–" : v.toFixed(1));

  const rightValue = !round
    ? "?"
    : !revealed
      ? "?"
      : phase === "counting"
        ? displayValue.toFixed(1)
        : format(round.right.stats[round.stat]);

  const arenaStyle = { "--slide-ms": `${SLIDE_MS}ms` } as CSSProperties;

  if (!enough) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-bold">Nothing matches these settings</h1>
        <p className="text-sm text-muted">
          There aren't two {seasonMode ? "seasons" : "players"} close
          enough to compare. Widen the year range, lower the award
          requirement, or pick more stats. If players.json predates the
          season/award fields, regenerate it with scripts/scrape_players.py
          --resume.
        </p>
        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-accent-contrast transition hover:brightness-110"
        >
          Open settings
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-3 py-5 sm:px-8 sm:py-10">
      <header className="mb-5 flex items-end justify-between gap-3 sm:mb-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-3xl">
            NBA Higher or Lower
          </h1>
          <p className="text-xs text-muted sm:text-sm">
            {seasonMode ? "Award-winning seasons" : "Career averages"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full border border-border bg-surface-raised px-4 py-1.5 text-sm font-semibold tabular-nums sm:text-base">
            Score <span className="ml-1 text-accent">{score}</span>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Settings"
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface-raised px-3 py-1.5 text-sm font-semibold transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-4 sm:text-base"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4 sm:size-5"
              aria-hidden="true"
            >
              <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="8" cy="17" r="2" />
            </svg>
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </header>

      <p className="mb-4 text-center text-sm font-medium text-muted sm:mb-6 sm:text-lg">
        {round ? (
          <>
            Does <strong className="text-foreground">{round.right.name}</strong>
            {round.right.season ? ` (${round.right.season})` : ""} average
            higher or lower {statDef.short} than{" "}
            <strong className="text-foreground">{round.left.name}</strong>
            {round.left.season ? ` (${round.left.season})` : ""}?
          </>
        ) : (
          "Loading players…"
        )}
      </p>

      <section
        ref={arenaRef}
        style={arenaStyle}
        className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2 sm:gap-6"
      >
        {round ? (
          <>
            <PlayerCard
              key={round.left.key}
              entry={round.left}
              slot="left"
              statLabel={statLabel}
              valueText={format(round.left.stats[round.stat])}
              motion={phase === "sliding" ? "leave" : "idle"}
            />
            <PlayerCard
              key={round.right.key}
              entry={round.right}
              slot="right"
              statLabel={statLabel}
              valueText={rightValue}
              tone={rightTone}
              motion={phase === "sliding" ? "slide" : "idle"}
              slideDx={slideDx}
            />
          </>
        ) : (
          <>
            <div className="col-start-1 row-start-1 aspect-[3/4] animate-pulse rounded-3xl bg-surface" />
            <div className="col-start-3 row-start-1 aspect-[3/4] animate-pulse rounded-3xl bg-surface" />
          </>
        )}

        <div className="z-20 col-start-2 row-start-1 flex flex-col items-center gap-2 self-center sm:gap-4">
          <GuessButton
            label="Higher"
            direction="up"
            disabled={!canGuess || !round}
            onClick={() => handleGuess("higher")}
          />
          <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted sm:text-xs">
            or
          </span>
          <GuessButton
            label="Lower"
            direction="down"
            disabled={!canGuess || !round}
            onClick={() => handleGuess("lower")}
          />
        </div>
      </section>

      <p className="sr-only" aria-live="polite">
        {phase === "result" || phase === "gameover"
          ? correct
            ? "Correct"
            : "Wrong"
          : ""}
      </p>

      {phase === "gameover" && round && (
        <div className="card-enter mx-auto mt-8 flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-border bg-surface-raised p-6 text-center shadow-[0_12px_32px_-16px_rgba(90,70,30,0.45)]">
          <p className="text-lg font-semibold">Game over</p>
          <p className="text-sm text-muted">
            {round.right.name}
            {round.right.season ? ` (${round.right.season})` : ""} had{" "}
            <span className="font-semibold text-foreground">
              {format(round.right.stats[round.stat])}
            </span>{" "}
            {statDef.short}. Final score:{" "}
            <span className="font-semibold text-foreground">{score}</span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onNewGame}
              className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-accent-contrast transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Play again
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Settings
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function GuessButton({
  label,
  direction,
  disabled,
  onClick,
}: {
  label: string;
  direction: "up" | "down";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="group flex flex-col items-center gap-1 focus-visible:outline-none"
    >
      <span className="grid size-11 place-items-center rounded-full bg-accent text-accent-contrast shadow-[0_8px_18px_-8px_rgba(120,50,20,0.7)] transition group-hover:scale-105 group-hover:brightness-110 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent group-active:scale-95 group-disabled:opacity-40 group-disabled:shadow-none group-disabled:group-hover:scale-100 sm:size-16">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5 sm:size-7"
          aria-hidden="true"
        >
          {direction === "up" ? (
            <path d="M6 15l6-6 6 6" />
          ) : (
            <path d="M6 9l6 6 6-6" />
          )}
        </svg>
      </span>
      <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-muted sm:text-xs">
        {label}
      </span>
    </button>
  );
}
