// scripts/printPlayoffSchedule.ts
import fs from "fs";
import path from "path";

type Game = {
    date: string;            // YYYY-MM-DD
    home_team: string;
    away_team: string;
    time: string;
    venue: string;
    special_game: string | null;
};

type TeamSchedule = {
    team: string;            // Team abbreviation (e.g., "NSH")
    schedule: Game[];
};

// 🔗 Adjust if your file ever moves
const SCHEDULE_PATH = path.join(__dirname, "../src/data/nhlSchedule.json");

// 🧭 Define your fantasy playoff weeks (edit if needed)
const PLAYOFF_WEEKS = [
    { week: 23, start: "2026-03-16", end: "2026-03-22" },
    { week: 24, start: "2026-03-23", end: "2026-03-29" },
    { week: 25, start: "2026-03-30", end: "2026-04-05" }, // ✅ Final week (ends Apr 5)
];


// Off-night identifiers (use your fantasy defaults)
const OFF_NIGHTS = ["Wed", "Fri", "Sun"] as const;

// ———————————————————————————————————————————————————————————
// Helpers (timezone-safe)
// ———————————————————————————————————————————————————————————
const DAY_SHORTS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function dayShortUTC(dateStr: string): (typeof DAY_SHORTS)[number] {
    // Parse as UTC to avoid local TZ shifting the day
    const d = new Date(`${dateStr}T00:00:00Z`);
    const idx = d.getUTCDay(); // always 0–6
    const val = DAY_SHORTS[idx];
    if (!val) throw new Error(`Invalid weekday index for date: ${dateStr}`);
    return val;
}


function countGames(schedule: Game[], start: string, end: string) {
    const startDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T23:59:59Z`);
    const filtered = schedule.filter((g) => {
        const d = new Date(`${g.date}T00:00:00Z`);
        return d >= startDate && d <= endDate;
    });
    const offNightCount = filtered.filter((g) =>
        (OFF_NIGHTS as readonly string[]).includes(dayShortUTC(g.date))
    ).length;
    return { total: filtered.length, offNights: offNightCount };
}

function printPlayoffSchedule(teamAbbr: string) {
    if (!fs.existsSync(SCHEDULE_PATH)) {
        console.error(`❌ Schedule file not found at: ${SCHEDULE_PATH}`);
        process.exit(1);
    }

    const raw = fs.readFileSync(SCHEDULE_PATH, "utf8");
    const data: TeamSchedule[] = JSON.parse(raw);

    // Team key in your JSON is the abbreviation per your spec
    const team = data.find((t) => t.team.toLowerCase() === teamAbbr.toLowerCase());
    if (!team) {
        console.error(`❌ Team '${teamAbbr}' not found in schedule.`);
        process.exit(1);
    }

    console.log(`\n🗓️  Playoff Schedule for ${team.team}`);
    console.log("| Week | Dates | GP | Off-Nights (Wed/Fri/Sun) |");
    console.log("|------|--------|----|--------------------------|");

    PLAYOFF_WEEKS.forEach(({ week, start, end }) => {
        const { total, offNights } = countGames(team.schedule, start, end);
        console.log(`| ${week} | ${start} → ${end} | ${total} | ${offNights} |`);
    });

    console.log(
        "\n✅ Copy this markdown table into your blog post’s 'Playoff Schedule' section."
    );
}

// 🧠 Usage:  npx tsx scripts/printPlayoffSchedule.ts NSH
const teamAbbr = process.argv[2];
if (!teamAbbr) {
    console.error("Usage: npx tsx scripts/printPlayoffSchedule.ts TEAM_ABBR");
    process.exit(1);
}

printPlayoffSchedule(teamAbbr);
