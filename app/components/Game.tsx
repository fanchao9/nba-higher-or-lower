"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import PlayerCard, { type StatTone } from "@/app/components/PlayerCard";
import {
  hasEnoughPlayers,
  isGuessCorrect,
  pickNextPlayer,
  pickStartingPair,
  type Guess,
  type Player,
} from "@/app/lib/players";

type Phase = "guessing" | "counting" | "result" | "sliding" | "gameover";

type Round = {
  left: Player;
  right: Player;
  seen: number[];
};

const COUNT_MS = 1600;
const RESULT_PAUSE_MS = 900;
const SLIDE_MS = 650;

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

function startRound(players: Player[]): Round {
  const [left, right] = pickStartingPair(players);
  return { left, right, seen: [left.id, right.id] };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function Game({ players }: { players: Player[] }) {
  const enoughPlayers = hasEnoughPlayers(players);
  const [round, setRound] = useState<Round | null>(null);
  const [phase, setPhase] = useState<Phase>("guessing");
  const [guess, setGuess] = useState<Guess | null>(null);
  const [score, setScore] = useState(0);
  const [displayPpg, setDisplayPpg] = useState(0);
  const [slideDx, setSlideDx] = useState(0);
  const arenaRef = useRef<HTMLElement>(null);

  const correct =
    round && guess ? isGuessCorrect(round.left, round.right, guess) : null;

  useEffect(() => {
    if (enoughPlayers) setRound(startRound(players));
  }, [players, enoughPlayers]);

  // animate the right player's stat from 0 up to the real value
  useEffect(() => {
    if (phase !== "counting" || !round || !guess) return;

    const target = round.right.ppg;
    const duration = prefersReducedMotion() ? 0 : COUNT_MS;
    const wasCorrect = isGuessCorrect(round.left, round.right, guess);
    const startedAt = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration);
      setDisplayPpg(target * easeOutQuart(t));
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

  useEffect(() => {
    if (phase !== "result") return;

    const timer = setTimeout(() => {
      if (!correct) {
        setPhase("gameover");
        return;
      }
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

  // sliding of right player to left side
  useEffect(() => {
    if (phase !== "sliding" || !round) return;

    const timer = setTimeout(() => {
      const { next, seen } = pickNextPlayer(players, round.seen, round.right);
      setRound({ left: round.right, right: next, seen });
      setGuess(null);
      setDisplayPpg(0);
      setSlideDx(0);
      setPhase("guessing");
    }, SLIDE_MS);

    return () => clearTimeout(timer);
  }, [phase, round, players]);

  function handleGuess(choice: Guess) {
    if (phase !== "guessing") return;
    setGuess(choice);
    setDisplayPpg(0);
    setPhase("counting");
  }

  function handlePlayAgain() {
    setRound(startRound(players));
    setScore(0);
    setGuess(null);
    setDisplayPpg(0);
    setSlideDx(0);
    setPhase("guessing");
  }

  const canGuess = phase === "guessing";
  const revealed = phase !== "guessing";
  const rightTone: StatTone =
    phase === "result" || phase === "sliding" || phase === "gameover"
      ? correct
        ? "correct"
        : "wrong"
      : "neutral";

  const rightValue = !round
    ? "?"
    : !revealed
      ? "?"
      : phase === "counting"
        ? displayPpg.toFixed(1)
        : round.right.ppg.toFixed(1);

  const arenaStyle = { "--slide-ms": `${SLIDE_MS}ms` } as CSSProperties;

  if (!enoughPlayers) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-xl font-bold">Not enough player data</h1>
        <p className="text-sm text-muted">
          The game needs at least two players with different PPG in
          app/data/players.json. Run the scraper (scripts/scrape_players.py).
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-3 py-5 sm:px-8 sm:py-10">
      <header className="mb-5 flex items-end justify-between gap-4 sm:mb-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-3xl">
            NBA Higher or Lower
          </h1>
          <p className="text-xs text-muted sm:text-sm">
            Career points per game
          </p>
        </div>
        <div className="rounded-full border border-border bg-surface-raised px-4 py-1.5 text-sm font-semibold tabular-nums sm:text-base">
          Score <span className="ml-1 text-accent">{score}</span>
        </div>
      </header>

      <p className="mb-4 text-center text-sm font-medium text-muted sm:mb-6 sm:text-lg">
        {round ? (
          <>
            Does <strong className="text-foreground">{round.right.name}</strong>{" "}
            average higher or lower than{" "}
            <strong className="text-foreground">{round.left.name}</strong>?
          </>
        ) : (
          "Loading players…"
        )}
      </p>

      <section
        ref={arenaRef}
        style={arenaStyle}
        className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-6"
      >
        {round ? (
          <>
            <PlayerCard
              key={round.left.id}
              player={round.left}
              slot="left"
              valueText={round.left.ppg.toFixed(1)}
              motion={phase === "sliding" ? "leave" : "idle"}
            />
            <PlayerCard
              key={round.right.id}
              player={round.right}
              slot="right"
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

        <div className="z-20 col-start-2 row-start-1 flex flex-col items-center gap-2 sm:gap-4">
          <GuessButton
            label="Higher"
            direction="up"
            disabled={!canGuess || !round}
            onClick={() => handleGuess("higher")}
          />
          <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted sm:text-xs">
            vs
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
            {round.right.name} averaged{" "}
            <span className="font-semibold text-foreground">
              {round.right.ppg.toFixed(1)}
            </span>{" "}
            PPG. Final score:{" "}
            <span className="font-semibold text-foreground">{score}</span>
          </p>
          <button
            type="button"
            onClick={handlePlayAgain}
            className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-accent-contrast transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Play again
          </button>
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
