// src/app/rankings/page.tsx
import ScheduleClient from "./ScheduleClient";

export const dynamic = "force-dynamic";

export default async function RankingsPage() {
  return (
    <section className="w-full bg-transparent">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          Fantasy Hockey Schedule Rankings
        </h1>

        <p className="mb-6 text-slate-700">
          Compare NHL team schedules, weekly game volume, and off-night advantages
          to find better fantasy hockey streamers.
        </p>

        <ScheduleClient />
      </div>
    </section>
  );
}