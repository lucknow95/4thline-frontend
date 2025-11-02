// src/app/rankings/page.tsx
import { fetchRankingsData, type LocalPlayer } from "@/lib/msf";
import RankingsClient from "./RankingsClient";

export const dynamic = "force-dynamic";

export default async function RankingsPage() {
  let players: LocalPlayer[] = [];
  try {
    const raw = await fetchRankingsData();
    players = Array.isArray(raw) ? raw : [];
  } catch (err) {
    console.error("[rankings] fetchRankingsData failed:", err);
  }

  return (
    <section className="w-full bg-transparent">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          Fantasy Hockey Player Rankings
        </h1>

        {/* ⚠️ Temporary notice for visitors */}
        <div className="mb-6 rounded-lg bg-amber-100 border border-amber-300 p-4 text-amber-800">
          <strong>⚠️ Stat Ingestion Under Construction:</strong> Player statistics are temporarily paused for the 2025–26 season while we transition data providers.
          Schedule tools and other site features remain active.
        </div>

        <RankingsClient initialPlayers={players} />
      </div>
    </section>
  );
}
