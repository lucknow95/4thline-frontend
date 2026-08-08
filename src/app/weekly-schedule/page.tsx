import type { Metadata } from "next";
import WeeklyScheduleClient from "./WeeklyScheduleClient";

export const metadata: Metadata = {
    title: "Weekly NHL Schedule | 4th Line Fantasy",
    description:
        "View every NHL team's weekly schedule by day, compare total games, and find teams that play on the days your fantasy roster needs.",
};

export default function WeeklySchedulePage() {
    return (
        <section className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">
                    Weekly NHL Schedule
                </h1>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 sm:text-base">
                    Compare every NHL team across the selected fantasy week. Select
                    specific days to show only teams that play on every day you need.
                </p>
            </div>

            <WeeklyScheduleClient />
        </section>
    );
}