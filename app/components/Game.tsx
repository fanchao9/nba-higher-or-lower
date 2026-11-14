"use client";

import { useMemo, useState } from "react";
import GameBoard from "@/app/components/GameBoard";
import SettingsMenu from "@/app/components/SettingsMenu";
import {
  DEFAULT_SETTINGS,
  buildEntries,
  clampSettings,
  yearBounds,
  type GameSettings,
} from "@/app/lib/filters";
import type { PlayerRecord } from "@/app/lib/players";


export default function Game({ players }: { players: PlayerRecord[] }) {
  const bounds = useMemo(() => yearBounds(players), [players]);
  const [settings, setSettings] = useState<GameSettings>(() =>
    clampSettings(DEFAULT_SETTINGS, bounds),
  );
  const [gameId, setGameId] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const entries = useMemo(
    () => buildEntries(players, settings),
    [players, settings],
  );

  function handleApply(next: GameSettings) {
    setSettings(next);
    setGameId((id) => id + 1);
    setMenuOpen(false);
  }

  return (
    <>
      <GameBoard
        key={gameId}
        entries={entries}
        settings={settings}
        showAll={showAll}
        onShowAllChange={setShowAll}
        onOpenSettings={() => setMenuOpen(true)}
        onNewGame={() => setGameId((id) => id + 1)}
      />
      <SettingsMenu
        open={menuOpen}
        settings={settings}
        players={players}
        bounds={bounds}
        onApply={handleApply}
        onClose={() => setMenuOpen(false)}
      />
    </>
  );
}
