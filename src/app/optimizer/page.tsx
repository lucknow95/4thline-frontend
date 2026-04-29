import rawLeagueSchedule from '@/data/nhlSchedule.json';
import { ymdToNumber, type TeamBlock as NewTeamBlock } from '@/lib/optimizer';
import { cityToAbbr, fullTeamToAbbr } from '@/lib/teamMaps';
import OptimizerClient from './OptimizerClient';

type OldGame = {
  date: string;
  home_team: string;
  away_team: string;
  time?: string | null;
  venue?: string | null;
  special_game?: string | null;
};

type OldTeamBlock = {
  team: string;
  schedule: OldGame[];
};

const ABBR_TO_FULL: Record<string, string> = {
  ANA: 'Anaheim Ducks',
  BOS: 'Boston Bruins',
  BUF: 'Buffalo Sabres',
  CGY: 'Calgary Flames',
  CAR: 'Carolina Hurricanes',
  CHI: 'Chicago Blackhawks',
  COL: 'Colorado Avalanche',
  CBJ: 'Columbus Blue Jackets',
  DAL: 'Dallas Stars',
  DET: 'Detroit Red Wings',
  EDM: 'Edmonton Oilers',
  FLA: 'Florida Panthers',
  LAK: 'Los Angeles Kings',
  MIN: 'Minnesota Wild',
  MTL: 'Montreal Canadiens',
  NSH: 'Nashville Predators',
  NJD: 'New Jersey Devils',
  NYI: 'New York Islanders',
  NYR: 'New York Rangers',
  OTT: 'Ottawa Senators',
  PHI: 'Philadelphia Flyers',
  PIT: 'Pittsburgh Penguins',
  SJS: 'San Jose Sharks',
  SEA: 'Seattle Kraken',
  STL: 'St. Louis Blues',
  TBL: 'Tampa Bay Lightning',
  TOR: 'Toronto Maple Leafs',
  VAN: 'Vancouver Canucks',
  VGK: 'Vegas Golden Knights',
  WSH: 'Washington Capitals',
  WPG: 'Winnipeg Jets',
  UTA: 'Utah Mammoth',
  UTM: 'Utah Mammoth',
};

const TEAM_CITY_BY_ABBR: Record<string, string> = {
  ANA: 'Anaheim',
  BOS: 'Boston',
  BUF: 'Buffalo',
  CGY: 'Calgary',
  CAR: 'Carolina',
  CHI: 'Chicago',
  COL: 'Colorado',
  CBJ: 'Columbus',
  DAL: 'Dallas',
  DET: 'Detroit',
  EDM: 'Edmonton',
  FLA: 'Florida',
  LAK: 'Los Angeles',
  MIN: 'Minnesota',
  MTL: 'Montreal',
  NSH: 'Nashville',
  NJD: 'New Jersey',
  NYI: 'New York Islanders',
  NYR: 'New York Rangers',
  OTT: 'Ottawa',
  PHI: 'Philadelphia',
  PIT: 'Pittsburgh',
  SJS: 'San Jose',
  SEA: 'Seattle',
  STL: 'St. Louis',
  TBL: 'Tampa Bay',
  TOR: 'Toronto',
  UTA: 'Salt Lake City',
  UTM: 'Salt Lake City',
  VAN: 'Vancouver',
  VGK: 'Vegas',
  WSH: 'Washington',
  WPG: 'Winnipeg',
};

function normalizeLabel(s: string | null | undefined): string {
  if (!s) return '';

  return s
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^St[.]?\s+Louis$/i, 'St. Louis')
    .replace(/^Montr(e|é)al$/i, 'Montréal');
}

function resolveAbbr(label: string): string | null {
  const name = normalizeLabel(label);
  const byFull = (fullTeamToAbbr as Record<string, string>)[name];

  if (byFull) return byFull;

  const byCity = (cityToAbbr as Record<string, string>)[name];

  if (byCity) return byCity;
  if (/^New York$/i.test(name)) return null;

  const first = name.split(' ')[0] ?? '';

  if (!first) return null;

  const byFirst = (cityToAbbr as Record<string, string>)[first];

  if (byFirst) return byFirst;

  return null;
}

function convertToNewBlocks(oldBlocks: OldTeamBlock[]): NewTeamBlock[] {
  const out: NewTeamBlock[] = [];

  for (const tb of oldBlocks) {
    const teamAbbr = tb.team;
    const teamFull = ABBR_TO_FULL[teamAbbr] ?? teamAbbr;

    const games = tb.schedule
      .map((g) => {
        const ymd = ymdToNumber(g.date);
        const isHome =
          normalizeLabel(g.home_team) === normalizeLabel(teamFull) ||
          resolveAbbr(g.home_team) === teamAbbr;

        const oppLabel = isHome ? g.away_team : g.home_team;
        const oppAbbr = resolveAbbr(oppLabel);

        if (Number.isNaN(ymd) || !oppAbbr) return null;

        return { ymd, home: isHome, opp: oppAbbr };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .sort((a, b) => a.ymd - b.ymd);

    out.push({ team: teamAbbr, games });
  }

  out.sort((a, b) => a.team.localeCompare(b.team));

  return out;
}

function getSeasonBounds(input: OldTeamBlock[] | NewTeamBlock[]): {
  startYmd: number;
  endYmd: number;
} {
  let minY = Number.POSITIVE_INFINITY;
  let maxY = 0;

  for (const block of input) {
    if ('schedule' in block && Array.isArray(block.schedule)) {
      for (const g of block.schedule) {
        const n = ymdToNumber(g.date);

        if (!Number.isNaN(n)) {
          if (n < minY) minY = n;
          if (n > maxY) maxY = n;
        }
      }
    }

    if ('games' in block && Array.isArray(block.games)) {
      for (const g of block.games) {
        const n = g.ymd;

        if (n < minY) minY = n;
        if (n > maxY) maxY = n;
      }
    }
  }

  if (!Number.isFinite(minY) || maxY === 0) {
    return { startYmd: 20251006, endYmd: 20260415 };
  }

  return { startYmd: minY, endYmd: maxY };
}

export default function Page() {
  const legacyBlocks = rawLeagueSchedule as OldTeamBlock[];
  const schedule: NewTeamBlock[] = convertToNewBlocks(legacyBlocks);
  const { startYmd, endYmd } = getSeasonBounds(schedule);

  return (
    <div className="px-4 py-6">
      <h1 className="text-3xl md:text-4xl font-bold mb-4 text-[rgb(var(--brand-dark))]">
        Fantasy Optimizer
      </h1>

      <div className="optimizer-table--compact">
        <OptimizerClient
          schedule={schedule}
          seasonStartYmd={startYmd}
          seasonEndYmd={endYmd}
          teamCityByAbbr={TEAM_CITY_BY_ABBR}
        />
      </div>
    </div>
  );
}