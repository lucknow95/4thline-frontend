// src/utils/dedupe.ts
import type { Player } from '@/types';

/** Fast, safe default: keep the first instance of each player.id */
export function dedupePlayersById(players: Player[]): Player[] {
  return Array.from(new Map(players.map(p => [p.id, p])).values());
}

/** Optional fallback if your data ever has bad/missing ids */
export function dedupePlayersByNameTeam(players: Player[]): Player[] {
  return Array.from(
    new Map(players.map(p => [`${p.name}|${p.team}`, p])).values()
  );
}
