// src/app/optimizer/page.tsx
import rawScheduleData from "@/data/nhlSchedule.json";
import type { TeamBlock } from "@/lib/optimizer";
import OptimizerClient from "./OptimizerClient";

export const dynamic = "force-dynamic";

type RawScheduleGame = {
  date: string;
  home_team: string;
  away_team: string;
};

type RawTeamSchedule = {
  team: string;
  schedule: RawScheduleGame[];
};

const ABBR_TO_FULL: Record<string, string> = {
  ANA: "Anaheim Ducks",
  BOS: "Boston Bruins",
  BUF: "Buffalo Sabres",
  CGY: "Calgary Flames",
  CAR: "Carolina Hurricanes",
  CHI: "Chicago Blackhawks",
  COL: "Colorado Avalanche",
  CBJ: "Columbus Blue Jackets",
  DAL: "Dallas Stars",
  DET: "Detroit Red Wings",
  EDM: "Edmonton Oilers",
  FLA: "Florida Panthers",
  LAK: "Los Angeles Kings",
  MIN: "Minnesota Wild",
  MTL: "Montreal Canadiens",
  NSH: "Nashville Predators",
  NJD: "New Jersey Devils",
  NYI: "New York Islanders",
  NYR: "New York Rangers",
  OTT: "Ottawa Senators",
  PHI: "Philadelphia Flyers",
  PIT: "Pittsburgh Penguins",
  SJS: "San Jose Sharks",
  SEA: "Seattle Kraken",
  STL: "St. Louis Blues",
  TBL: "Tampa Bay Lightning",
  TOR: "Toronto Maple Leafs",
  UTM: "Utah Mammoth",
  VAN: "Vancouver Canucks",
  VGK: "Vegas Golden Knights",
  WSH: "Washington Capitals",
  WPG: "Winnipeg Jets",
};

const TEAM_CITY_BY_ABBR: Record<string, string> = {
  ANA: "Anaheim",
  BOS: "Boston",
  BUF: "Buffalo",
  CGY: "Calgary",
  CAR: "Carolina",
  CHI: "Chicago",
  COL: "Colorado",
  CBJ: "Columbus",
  DAL: "Dallas",
  DET: "Detroit",
  EDM: "Edmonton",
  FLA: "Florida",
  LAK: "Los Angeles",
  MIN: "Minnesota",
  MTL: "Montreal",
  NSH: "Nashville",
  NJD: "New Jersey",
  NYI: "New York Islanders",
  NYR: "New York Rangers",
  OTT: "Ottawa",
  PHI: "Philadelphia",
  PIT: "Pittsburgh",
  SJS: "San Jose",
  SEA: "Seattle",
  STL: "St. Louis",
  TBL: "Tampa Bay",
  TOR: "Toronto",
  UTM: "Utah",
  VAN: "Vancouver",
  VGK: "Vegas",
  WSH: "Washington",
  WPG: "Winnipeg",
};

const NAME_TO_ABBR: Record<string, string> = Object.entries(ABBR_TO_FULL).reduce(
  (acc, [abbr, fullName]) => {
    acc[abbr] = abbr;
    acc[fullName] = abbr;

    const city = TEAM_CITY_BY_ABBR[abbr];
    if (city) {
      acc[city] = abbr;
    }

    return acc;
  },
  {} as Record<string, string>
);

function ymdFromDateString(date: string): number {
  return Number(date.replaceAll("-", ""));
}

function getTeamIsHome(teamAbbr: string, game: RawScheduleGame): boolean {
  const fullName = ABBR_TO_FULL[teamAbbr];
  const cityName = TEAM_CITY_BY_ABBR[teamAbbr];

  return game.home_team === fullName || game.home_team === cityName;
}

function getOpponentAbbr(teamAbbr: string, game: RawScheduleGame): string {
  const isHome = getTeamIsHome(teamAbbr, game);
  const opponentName = isHome ? game.away_team : game.home_team;

  return NAME_TO_ABBR[opponentName] ?? opponentName;
}

function normalizeSchedule(rawSchedule: RawTeamSchedule[]): TeamBlock[] {
  return rawSchedule.map((teamBlock) => {
    const teamAbbr = teamBlock.team;

    return {
      team: teamAbbr,
      games: teamBlock.schedule.map((game) => ({
        ymd: ymdFromDateString(game.date),
        home: getTeamIsHome(teamAbbr, game),
        opp: getOpponentAbbr(teamAbbr, game),
      })),
    };
  });
}

function getSeasonBounds(schedule: TeamBlock[]) {
  const allGameDates = schedule.flatMap((team) =>
    team.games.map((game) => game.ymd)
  );

  return {
    startYmd: Math.min(...allGameDates),
    endYmd: Math.max(...allGameDates),
  };
}

export default async function OptimizerPage() {
  const schedule = normalizeSchedule(rawScheduleData as RawTeamSchedule[]);
  const { startYmd, endYmd } = getSeasonBounds(schedule);

  return (
    <section className="w-full bg-transparent">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <h1 className="mb-4 text-3xl font-bold md:text-4xl">
          Fantasy Hockey Schedule Optimizer
        </h1>

        <p className="mb-6 max-w-3xl text-slate-700">
          Compare NHL team schedules across custom windows, weekly ranges, game
          volume, home/away splits, back-to-backs, and streaming-friendly
          schedule density.
        </p>

        <OptimizerClient
          schedule={schedule}
          seasonStartYmd={startYmd}
          seasonEndYmd={endYmd}
          teamFullByAbbr={ABBR_TO_FULL}
        />
      </div>
    </section>
  );
}
