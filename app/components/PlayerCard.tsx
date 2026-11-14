"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { headshotUrl, type Entry } from "@/app/lib/players";
import { awardLabel } from "@/app/lib/stats";

export type StatTone = "neutral" | "correct" | "wrong";
export type CardMotion = "idle" | "slide" | "leave";

const MAX_BADGES = 4;

type PlayerCardProps = {
  entry: Entry;
  slot: "left" | "right";
  statLabel: string;
  valueText: string;
  tone?: StatTone;
  motion?: CardMotion;
  slideDx?: number;
};

const toneClass: Record<StatTone, string> = {
  neutral: "text-foreground",
  correct: "text-correct",
  wrong: "text-wrong",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

export default function PlayerCard({
  entry,
  slot,
  statLabel,
  valueText,
  tone = "neutral",
  motion = "idle",
  slideDx = 0,
}: PlayerCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const style: CSSProperties = {
    gridColumn: slot === "left" ? 1 : 3,
    gridRow: 1,
    zIndex: slot === "right" ? 10 : 0,
    transform: motion === "slide" ? `translateX(${-slideDx}px)` : undefined,
  };

  const motionClass =
    motion === "slide" ? "card-sliding" : motion === "leave" ? "card-leaving" : "";

  const isSeason = entry.season !== null;
  const badges = entry.awards.slice(0, MAX_BADGES);
  const extraBadges = entry.awards.length - badges.length;

  return (
    <article
      data-slot={slot}
      style={style}
      className={`card-enter ${motionClass} flex h-full min-w-0 flex-col gap-2 rounded-2xl border border-border bg-surface-raised p-2.5 shadow-[0_12px_32px_-16px_rgba(90,70,30,0.45)] sm:gap-3 sm:rounded-3xl sm:p-4`}
    >
      <div className="relative aspect-[1040/760] w-full overflow-hidden rounded-xl bg-photo sm:rounded-2xl">
        {imageFailed ? (
          <div
            aria-hidden="true"
            className="grid h-full w-full place-items-center text-3xl font-semibold text-muted sm:text-5xl"
          >
            {initials(entry.name)}
          </div>
        ) : (
          <Image
            src={headshotUrl(entry.playerId)}
            alt={`${entry.name} headshot`}
            fill
            sizes="(min-width: 1024px) 400px, (min-width: 640px) 36vw, 42vw"
            className="object-cover"
            onError={() => setImageFailed(true)}
          />
        )}
      </div>

      <h2
        className={`text-balance text-center text-[clamp(0.9rem,3.6vw,1.5rem)] font-semibold leading-tight tracking-tight ${
          isSeason ? "" : "min-h-[2.5em]"
        }`}
      >
        {entry.name}
      </h2>

      {isSeason && (
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-xs font-medium text-muted sm:text-sm">
            {entry.season}
            {entry.team ? ` · ${entry.team}` : ""}
          </p>
          <ul className="flex flex-wrap justify-center gap-1">
            {badges.map((code) => (
              <li
                key={code}
                className="rounded-full bg-photo px-2 py-0.5 text-[0.6rem] font-semibold text-muted sm:text-xs"
              >
                {awardLabel(code)}
              </li>
            ))}
            {extraBadges > 0 && (
              <li className="rounded-full bg-photo px-2 py-0.5 text-[0.6rem] font-semibold text-muted sm:text-xs">
                +{extraBadges}
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="mt-auto flex flex-col items-center rounded-xl bg-surface px-2 py-2 sm:py-3">
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted sm:text-xs">
          {statLabel}
        </span>
        <span
          className={`text-[clamp(1.75rem,8vw,3.5rem)] font-bold leading-none tabular-nums transition-colors duration-300 ${toneClass[tone]}`}
        >
          {valueText}
        </span>
      </div>
    </article>
  );
}
