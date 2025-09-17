import { arenaMap } from '@/data/arenaMap'; // named export
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
  ANA: 'Anaheim Ducks', BOS: 'Boston Bruins', BUF: 'Buffalo Sabres', CGY: 'Calgary Flames',
  CAR: 'Carolina Hurricanes', CHI: 'Chicago Blackhawks', COL: 'Colorado Avalanche',
  CBJ: 'Columbus Blue Jackets', DAL: 'Dallas Stars', DET: 'Detroit Red Wings',
  EDM: 'Edmonton Oilers', FLA: 'Florida Panthers', LAK: 'Los Angeles Kings',
  MIN: 'Minnesota Wild', MTL: 'Montreal Canadiens', NSH: 'Nashville Predators',
  NJD: 'New Jersey Devils', NYI: 'New York Islanders', NYR: 'New York Rangers',
  OTT: 'Ottawa Senators', PHI: 'Philadelphia Flyers', PIT: 'Pittsburgh Penguins',
  SJS: 'San Jose Sharks', SEA: 'Seattle Kraken', STL: 'St. Louis Blues',
  TBL: 'Tampa Bay Lightning', TOR: 'Toronto Maple Leafs', VAN: 'Vancouver Canucks',
  VGK: 'Vegas Golden Knights', WSH: 'Washington Capitals', WPG: 'Winnipeg Jets',
  UTA: 'Utah Mammoth', UTM: 'Utah Mammoth',
};

function normalizeLabel(s: string | null | undefined): string {
  if (!s) return '';
  return s.trim().replace(/\s+/g, ' ').replace(/^St[.]?\s+Louis$/i, 'St. Louis').replace(/^Montr(e|é)al$/i, 'Montréal');
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

import type { TeamBlock as TB } from '@/lib/optimizer';
function convertToNewBlocks(oldBlocks: OldTeamBlock[]): TB[] {
  const out: TB[] = [];
  for (const tb of oldBlocks) {
    const teamAbbr = tb.team;
    const teamFull = ABBR_TO_FULL[teamAbbr] ?? teamAbbr;
    const games = tb.schedule
      .map((g) => {
        const ymd = ymdToNumber(g.date);
        const isHome =
          normalizeLabel(g.home_team) === normalizeLabel(teamFull) || resolveAbbr(g.home_team) === teamAbbr;
        const oppLabel = isHome ? g.away_team : g.home_team;
        const oppAbbr = resolveAbbr(oppLabel);
        if (Number.isNaN(ymd) || !oppAbbr) return null;
        return { ymd, home: isHome, opp: oppAbbr };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => a.ymd - b.ymd);
    out.push({ team: teamAbbr, games });
  }
  out.sort((a, b) => a.team.localeCompare(b.team));
  return out;
}

function getSeasonBounds(input: OldTeamBlock[] | NewTeamBlock[]): { startYmd: number; endYmd: number } {
  let minY = Number.POSITIVE_INFINITY;
  let maxY = 0;
  for (const block of input as any[]) {
    const sched = (block as OldTeamBlock).schedule;
    const games = (block as NewTeamBlock).games;
    if (Array.isArray(sched)) {
      for (const g of sched) {
        const n = ymdToNumber(g.date);
        if (!Number.isNaN(n)) { if (n < minY) minY = n; if (n > maxY) maxY = n; }
      }
    } else if (Array.isArray(games)) {
      for (const g of games) { const n = g.ymd; if (n < minY) minY = n; if (n > maxY) maxY = n; }
    }
  }
  if (!isFinite(minY) || maxY === 0) return { startYmd: 20251006, endYmd: 20260415 };
  return { startYmd: minY, endYmd: maxY };
}

function buildCityMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [abbr, full] of Object.entries(ABBR_TO_FULL)) {
    const rec = (arenaMap as Record<string, { city: string; venue: string }>)[full];
    map[abbr] = rec?.city || (cityToAbbr[full] ? full : abbr);
  }
  map.UTA = 'Salt Lake City'; map.UTM = 'Salt Lake City';
  return map;
}

export default function Page() {
  const legacyBlocks = rawLeagueSchedule as OldTeamBlock[];
  const schedule: NewTeamBlock[] = convertToNewBlocks(legacyBlocks);
  const { startYmd, endYmd } = getSeasonBounds(schedule);
  const teamCityByAbbr = buildCityMap();

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
          teamCityByAbbr={teamCityByAbbr}
        />
      </div>
    </div>
  );
}
