"use client";

import Image from "next/image";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { headshotUrl, type Entry } from "@/app/lib/players";
import {
  DISPLAY_ROWS,
  STATS,
  STAT_KEYS,
  awardLabel,
  formatPct,
  formatStat,
  type StatKey,
} from "@/app/lib/stats";

export type StatTone = "neutral" | "correct" | "wrong";
export type CardMotion = "idle" | "slide" | "leave";

const MAX_BADGES = 4;

type PlayerCardProps = {
  entry: Entry;
  slot: "left" | "right";
  stat: StatKey;
  fromStat?: StatKey | null;
  scope: "Career" | "Season";
  valueText: string;
  tone?: StatTone;
  showAll?: boolean;
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
  stat,
  fromStat = null,
  scope,
  valueText,
  tone = "neutral",
  showAll = false,
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
        {entry.hasPhoto === false || imageFailed ? (
          <Monogram name={entry.name} />
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

      <StatArea
        showAll={showAll}
        entry={entry}
        stat={stat}
        fromStat={fromStat}
        scope={scope}
        valueText={valueText}
        tone={tone}
      />
    </article>
  );
}

// Shown when the NBA has no photo for a player
function Monogram({ name }: { name: string }) {
  return (
    <div
      aria-hidden="true"
      className="relative grid h-full w-full place-items-center bg-gradient-to-b from-photo to-border"
    >
      <svg
        viewBox="0 0 260 190"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full text-muted/20"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M30 190C30 100 75 40 130 40s100 60 100 190" />
        <path d="M72 190V92h116v98" />
        <circle cx="130" cy="92" r="40" />
      </svg>
      <span className="relative text-4xl font-bold tracking-wide text-muted sm:text-6xl">
        {initials(name)}
      </span>
    </div>
  );
}

type StatBlockProps = {
  entry: Entry;
  stat: StatKey;
  valueText: string;
  tone: StatTone;
};

const STAT_AREA_SETTLE_MS = 530;

function StatArea({
  showAll,
  fromStat,
  scope,
  ...block
}: StatBlockProps & {
  showAll: boolean;
  fromStat: StatKey | null;
  scope: "Career" | "Season";
}) {
  // `shown` is the view on screen. `leaving` is the view fading out (true =
  // the full list, false = the single stat, null = none).
  const [shown, setShown] = useState(showAll);
  const [leaving, setLeaving] = useState<boolean | null>(null);
  if (showAll !== shown) {
    setShown(showAll);
    setLeaving(shown);
  }

  const areaRef = useRef<HTMLDivElement>(null);
  const lastHeight = useRef<number | null>(null);

  useEffect(() => {
    const el = areaRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([item]) => {
      lastHeight.current = item.contentRect.height;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = areaRef.current;
    const from = lastHeight.current;
    if (!el || from === null) return;
    el.style.transition = "none";
    el.style.height = "auto";
    const to = el.offsetHeight;
    if (to === from) {
      el.style.transition = "";
      el.style.height = "";
      return;
    }
    el.style.height = `${from}px`;
    void el.offsetHeight;
    el.style.transition = "";
    el.style.height = `${to}px`;
  }, [shown]);

  useEffect(() => {
    if (leaving === null) return;
    const timer = setTimeout(() => {
      setLeaving(null);
      if (areaRef.current) areaRef.current.style.height = "";
    }, STAT_AREA_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [leaving, shown]);

  const layerClass = (isAll: boolean) =>
    leaving === isAll
      ? "stat-area-out absolute inset-x-0 top-0"
      : leaving !== null
        ? "stat-area-in"
        : "";

  return (
    <div
      ref={areaRef}
      className="stat-area relative mt-auto overflow-hidden rounded-xl bg-surface"
    >
      {(!shown || leaving === false) && (
        <div key="single" className={layerClass(false)} inert={leaving === false}>
          <SingleStat {...block} fromStat={fromStat} scope={scope} />
        </div>
      )}
      {(shown || leaving === true) && (
        <div key="all" className={layerClass(true)} inert={leaving === true}>
          <AllStats {...block} />
        </div>
      )}
    </div>
  );
}

function SingleStat({
  entry,
  stat,
  fromStat,
  scope,
  valueText,
  tone,
}: StatBlockProps & { fromStat: StatKey | null; scope: "Career" | "Season" }) {
  // `fromStat` is only set for a moment after a new round starts (the board
  // clears it once the slide has played), so this block never replays the
  // animation when it remounts, e.g. after toggling "Show all stats".
  const leaving = fromStat !== null && fromStat !== stat;

  return (
    <div className="relative overflow-hidden rounded-xl">
      {leaving && fromStat && (
        <div
          data-testid="stat-slide-out"
          aria-hidden="true"
          className="stat-slide-out absolute inset-0 flex flex-col items-center px-2 py-2 sm:py-3"
        >
          <StatText
            label={`${scope} ${STATS[fromStat].short}`}
            value={formatStat(entry.stats[fromStat])}
            valueClass="text-correct"
          />
        </div>
      )}
      <div
        className={`flex flex-col items-center px-2 py-2 sm:py-3 ${
          leaving ? "stat-slide-in" : ""
        }`}
      >
        <StatText
          label={`${scope} ${STATS[stat].short}`}
          value={valueText}
          valueClass={toneClass[tone]}
        />
      </div>
    </div>
  );
}

function StatText({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <>
      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted sm:text-xs">
        {label}
      </span>
      <span
        className={`text-[clamp(1.75rem,8vw,3.5rem)] font-bold leading-none tabular-nums transition-colors duration-300 ${valueClass}`}
      >
        {value}
      </span>
    </>
  );
}

function AllStats({ entry, stat, valueText, tone }: StatBlockProps) {
  const index = STAT_KEYS.indexOf(stat);

  return (
    <div className="p-1.5 sm:p-2">
      <div className="relative [--row-h:1.5rem] sm:[--row-h:1.75rem]">
        <div
          aria-hidden="true"
          className="stat-highlight absolute inset-x-0 top-0 rounded-lg bg-accent/15 ring-1 ring-accent/35"
          style={{
            height: "var(--row-h)",
            transform: `translateY(calc(var(--row-h) * ${index}))`,
          }}
        />
        <dl className="relative">
          {DISPLAY_ROWS.map((row) => {
            const compared = row.id === stat;
            const text = compared
              ? valueText
              : row.kind === "stat"
                ? formatStat(entry.stats[row.id])
                : formatPct(entry.shooting[row.id]);
            return (
              <div
                key={row.id}
                className="flex h-[var(--row-h)] items-center justify-between px-2 text-xs sm:text-sm"
              >
                <dt
                  className={`font-semibold ${compared ? "text-foreground" : "text-muted"}`}
                >
                  {row.label}
                </dt>
                <dd
                  className={`tabular-nums transition-colors duration-300 ${
                    compared
                      ? `text-sm font-bold sm:text-base ${toneClass[tone]}`
                      : "font-medium text-foreground"
                  }`}
                >
                  {text}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
}
