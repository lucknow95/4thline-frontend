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
    // Transparent so the global light-blue background is visible edge-to-edge
    <section className="w-full bg-transparent">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          Fantasy Hockey Player Rankings
        </h1>

        <RankingsClient initialPlayers={players} />
      </div>
    </section>
  );
}
