// src/app/players/[id]/page.tsx
import rawPlayers from "@/data/realPlayersWithSchedule.json";
import type { Player } from "@/types";
import { filterPlayers } from "@/types/guards";
import { dedupePlayersById } from "@/utils/dedupe";
import { notFound } from "next/navigation";
import PlayerPageClient from "./PlayerPageClient";

const NUM_WEEKS = 27;

/**
 * Validate + de-duplicate once at module scope so it’s cached by the module system
 * and not recomputed per request.
 */
const ALL_PLAYERS: Player[] = dedupePlayersById(
  filterPlayers(rawPlayers as unknown)
);

interface PlayerPageProps {
  params: { id: string };
}

export default function PlayerPage({ params }: PlayerPageProps) {
  // Be tolerant of any weird param shapes and ensure non-negative integer
  const idStr = Array.isArray(params.id) ? params.id[0] : params.id;
  const playerId = Number(idStr);
  if (!Number.isInteger(playerId) || playerId < 0) notFound();

  const player = ALL_PLAYERS.find((p) => p.id === playerId);
  if (!player) notFound();

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <PlayerPageClient player={player} numWeeks={NUM_WEEKS} />
    </main>
  );
}

