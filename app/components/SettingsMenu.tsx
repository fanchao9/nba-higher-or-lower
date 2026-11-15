"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Switch from "@/app/components/Switch";
import {
  DEFAULT_SETTINGS,
  buildEntries,
  clampSettings,
  orderedStats,
  type GameSettings,
  type YearBounds,
} from "@/app/lib/filters";
import { hasEnoughEntries, type PlayerRecord } from "@/app/lib/players";
import { STATS, STAT_KEYS, type StatKey } from "@/app/lib/stats";

const MAX_AWARD_FILTER = 10;

type SettingsMenuProps = {
  open: boolean;
  settings: GameSettings;
  players: PlayerRecord[];
  bounds: YearBounds;
  onApply: (settings: GameSettings) => void;
  onClose: () => void;
};

export default function SettingsMenu({
  open,
  settings,
  players,
  bounds,
  onApply,
  onClose,
}: SettingsMenuProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      // Clicking away closes dialog
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      aria-labelledby="settings-title"
      className="m-auto max-h-[92dvh] w-[min(34rem,calc(100vw-1rem))] overflow-y-auto rounded-3xl border border-border bg-surface-raised p-0 text-foreground shadow-[0_24px_60px_-20px_rgba(60,40,10,0.55)] backdrop:bg-[#2b2419]/45"
    >
      {open && (
        <SettingsForm
          settings={settings}
          players={players}
          bounds={bounds}
          onApply={onApply}
          onClose={onClose}
        />
      )}
    </dialog>
  );
}

function SettingsForm({
  settings,
  players,
  bounds,
  onApply,
  onClose,
}: Omit<SettingsMenuProps, "open">) {
  const [draft, setDraft] = useState<GameSettings>(settings);

  const preview = useMemo(() => buildEntries(players, draft), [players, draft]);
  const playable = useMemo(
    () => hasEnoughEntries(preview, draft.stats),
    [preview, draft.stats],
  );

  const update = (patch: Partial<GameSettings>) =>
    setDraft((d) => ({ ...d, ...patch }));

  function toggleStat(key: StatKey) {
    const next = new Set(draft.stats);
    if (next.has(key)) {
      if (next.size === 1) return;
      next.delete(key);
    } else {
      next.add(key);
    }
    update({ stats: orderedStats(next) });
  }

  const noun = draft.seasonMode ? "seasons" : "players";

  return (
    <form
      className="flex flex-col gap-6 p-5 sm:p-7"
      onSubmit={(e) => {
        e.preventDefault();
        if (playable) onApply(draft);
      }}
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 id="settings-title" className="text-xl font-bold tracking-tight">
            Game settings
          </h2>
          <p className="text-sm text-muted">
            Apply and start by pressing GO
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.25}
            strokeLinecap="round"
            className="size-4"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      {/* Game mode */}
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface p-4">
        <div>
          <p id="mode-label" className="font-semibold">
            Compare seasons
          </p>
          <p className="text-sm text-muted">
            Compare award-winning seasons against each other (e.g. one MVP
            year vs another) instead of career averages.
          </p>
        </div>
        <Switch
          checked={draft.seasonMode}
          onChange={(seasonMode) => update({ seasonMode })}
          aria-labelledby="mode-label"
        />
      </div>

      {/* Year range */}
      <fieldset className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <legend className="font-semibold">Years</legend>
          <span className="text-sm font-semibold tabular-nums text-accent">
            {draft.yearFrom} – {draft.yearTo}
          </span>
        </div>
        <YearRange
          min={bounds.min}
          max={bounds.max}
          from={draft.yearFrom}
          to={draft.yearTo}
          onChange={(yearFrom, yearTo) => update({ yearFrom, yearTo })}
        />
        <p className="text-xs text-muted">
          {draft.seasonMode
            ? "Seasons that ended in these years (2024 = the 2023-24 season)."
            : "Players whose careers overlap these years (2024 = the 2023-24 season)."}
        </p>
      </fieldset>

      {/* Awards */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <label htmlFor="min-awards" className="font-semibold">
            Minimum award seasons
          </label>
          <span className="text-sm font-semibold tabular-nums text-accent">
            {draft.minAwardSeasons === 0 ? "Any" : `${draft.minAwardSeasons}+`}
          </span>
        </div>
        <input
          id="min-awards"
          type="range"
          min={0}
          max={MAX_AWARD_FILTER}
          step={1}
          value={draft.minAwardSeasons}
          onChange={(e) => update({ minAwardSeasons: Number(e.target.value) })}
          className="w-full accent-accent"
        />
        <p className="text-xs text-muted">
          Counts MVP, Finals MVP, DPOY, ROY, MIP, 6th Man, Clutch POY and
          All-NBA seasons.
        </p>
      </div>

      {/* Stats */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Stats to compare</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {STAT_KEYS.map((key) => {
            const checked = draft.stats.includes(key);
            const onlyOne = checked && draft.stats.length === 1;
            return (
              <label
                key={key}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  checked
                    ? "border-accent bg-accent/10"
                    : "border-border bg-surface"
                } ${onlyOne ? "cursor-not-allowed" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={onlyOne}
                  onChange={() => toggleStat(key)}
                  className="size-4 accent-accent"
                />
                <span>{STATS[key].short}</span>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-muted">
          Each round picks one of the checked stats at random (at least one is
          required). Players without data for a stat before the 1970s, are skipped for it.
        </p>
      </fieldset>

      {/* Summary + actions */}
      {/* Sticky so GO stays visible on short (phone) screens. */}
      <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col gap-3 border-t border-border bg-surface-raised px-5 pb-5 pt-4 sm:-mx-7 sm:-mb-7 sm:px-7 sm:pb-7">
        <p
          className={`text-sm ${playable ? "text-muted" : "font-semibold text-wrong"}`}
          aria-live="polite"
        >
          {playable
            ? `${preview.length} ${noun} match these settings.`
            : preview.length === 0
              ? `No ${noun} match. Widen the years or lower the award minimum.`
              : `Only ${preview.length} ${preview.length === 1 ? noun.replace(/s$/, "") : noun} found, which is not enough to compare.`}
        </p>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setDraft(clampSettings(DEFAULT_SETTINGS, bounds))}
            className="text-sm font-semibold text-muted underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Reset to defaults
          </button>
          <button
            type="submit"
            disabled={!playable}
            className="rounded-full bg-accent px-9 py-3 text-base font-bold tracking-wide text-accent-contrast shadow-[0_8px_18px_-8px_rgba(120,50,20,0.7)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            GO
          </button>
        </div>
      </div>
    </form>
  );
}

/** Two-thumb slider built from two overlapping native range inputs. */
function YearRange({
  min,
  max,
  from,
  to,
  onChange,
}: {
  min: number;
  max: number;
  from: number;
  to: number;
  onChange: (from: number, to: number) => void;
}) {
  const span = Math.max(1, max - min);
  const left = ((from - min) / span) * 100;
  const right = ((to - min) / span) * 100;

  return (
    <div className="dual-range relative h-6">
      {/* Inset by half a thumb so percentages line up with thumb centers. */}
      <div className="pointer-events-none absolute inset-x-[0.625rem] top-1/2 h-1.5 -translate-y-1/2">
        <div className="absolute inset-0 rounded-full bg-border" />
        <div
          className="absolute inset-y-0 rounded-full bg-accent"
          style={{ left: `${left}%`, width: `${right - left}%` }}
        />
      </div>
      {/* When both thumbs overlap on the upper half, the lower thumb must be
          on top, or it could never be dragged back down. */}
      <input
        type="range"
        aria-label="From year"
        min={min}
        max={max}
        step={1}
        value={from}
        style={{ zIndex: from > (min + max) / 2 ? 5 : 3 }}
        onChange={(e) => onChange(Math.min(Number(e.target.value), to), to)}
      />
      <input
        type="range"
        aria-label="To year"
        min={min}
        max={max}
        step={1}
        value={to}
        style={{ zIndex: 4 }}
        onChange={(e) => onChange(from, Math.max(Number(e.target.value), from))}
      />
    </div>
  );
}
