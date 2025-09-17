// src/utils/leagueSchedule.ts
import rawSchedule from '@/data/nhlSchedule.json';
import { generateWeekOptions } from '@/utils/fantasyWeeks';
import type { DayAbbr } from '@/types/hockey';

// Keep this in sync with other pages — canonical abbrs (UTA for Utah)
const TEAM_ABBR_MAP: Record<string, string> = {
  'Anaheim Ducks': 'ANA', 'Anaheim': 'ANA', 'ANA': 'ANA',
  'Boston Bruins': 'BOS', 'Boston': 'BOS', 'BOS': 'BOS',
  'Buffalo Sabres': 'BUF', 'Buffalo': 'BUF', 'BUF': 'BUF',
  'Calgary Flames': 'CGY', 'Calgary': 'CGY', 'CGY': 'CGY',
  'Carolina Hurricanes': 'CAR', 'Carolina': 'CAR', 'CAR': 'CAR',
  'Chicago Blackhawks': 'CHI', 'Chicago': 'CHI', 'CHI': 'CHI',
  'Colorado Avalanche': 'COL', 'Colorado': 'COL', 'COL': 'COL',
  'Columbus Blue Jackets': 'CBJ', 'Columbus': 'CBJ', 'CBJ': 'CBJ',
  'Dallas Stars': 'DAL', 'Dallas': 'DAL', 'DAL': 'DAL',
  'Detroit Red Wings': 'DET', 'Detroit': 'DET', 'DET': 'DET',
  'Edmonton Oilers': 'EDM', 'Edmonton': 'EDM', 'EDM': 'EDM',
  'Florida Panthers': 'FLA', 'Florida': 'FLA', 'FLA': 'FLA', 'FLO': 'FLA',
  'Los Angeles Kings': 'LAK', 'Los Angeles': 'LAK', 'LAK': 'LAK',
  'Minnesota Wild': 'MIN', 'Minnesota': 'MIN', 'MIN': 'MIN',
  'Montreal Canadiens': 'MTL', 'Montreal': 'MTL', 'Montréal Canadiens': 'MTL', 'Montréal': 'MTL', 'MTL': 'MTL',
  'Nashville Predators': 'NSH', 'Nashville': 'NSH', 'NSH': 'NSH',
  'New Jersey Devils': 'NJD', 'New Jersey': 'NJD', 'NJD': 'NJD',
  'New York Islanders': 'NYI', 'New York': 'NYI', 'NYI': 'NYI',
  'New York Rangers': 'NYR', 'NYR': 'NYR',
  'Ottawa Senators': 'OTT', 'Ottawa': 'OTT', 'OTT': 'OTT',
  'Philadelphia Flyers': 'PHI', 'Philadelphia': 'PHI', 'PHI': 'PHI',
  'Pittsburgh Penguins': 'PIT', 'Pittsburgh': 'PIT', 'PIT': 'PIT',
  'San Jose Sharks': 'SJS', 'San Jose': 'SJS', 'SJS': 'SJS',
  'Seattle Kraken': 'SEA', 'Seattle': 'SEA', 'SEA': 'SEA',
  'St. Louis Blues': 'STL', 'St. Louis': 'STL', 'St Louis': 'STL', 'STL': 'STL',
  'Tampa Bay Lightning': 'TBL', 'Tampa Bay': 'TBL', 'Tampa': 'TBL', 'TBL': 'TBL',
  'Toronto Maple Leafs': 'TOR', 'Toronto': 'TOR', 'TOR': 'TOR',
  'Vancouver Canucks': 'VAN', 'Vancouver': 'VAN', 'VAN': 'VAN',
  'Vegas Golden Knights': 'VGK', 'Vegas': 'VGK', 'VGK': 'VGK',
  'Washington Capitals': 'WSH', 'Washington': 'WSH', 'WSH': 'WSH',
  'Winnipeg Jets': 'WPG', 'Winnipeg': 'WPG', 'WPG': 'WPG', 'WPJ': 'WPG',
  // Utah normalization — use UTA everywhere
  'Utah Mammoth': 'UTA', 'Utah Hockey Club': 'UTA', 'Utah': 'UTA', 'UTM': 'UTA', 'UTA': 'UTA',
};
export function abbr(input: string) { return TEAM_ABBR_MAP[input] || input; }

type LeagueGame = { date: string; home_team: string; away_team: string };
type LeagueTeamBlock = { team: string; schedule: LeagueGame[] };

const blocks = (rawSchedule as unknown as LeagueTeamBlock[]) ?? [];
const GAMES_BY_TEAM = new Map<string, LeagueGame[]>();
for (const tb of blocks) {
  if (tb?.team && Array.isArray(tb.schedule)) GAMES_BY_TEAM.set(tb.team, tb.schedule);
}

// Given an ISO date string -> Mon=0..Sun=6
function isoToDow(dateStr: string): number {
  const d = new Date(dateStr);
  // getUTCDay: Sun=0..Sat=6 → convert to Mon=0..Sun=6
  return (d.getUTCDay() + 6) % 7;
}

const DAY_INDEX: Record<DayAbbr, number> = { Mon:0, Tue:1, Wed:2, Thu:3, Fri:4, Sat:5, Sun:6 };

export function getLeagueGamesThisWeek(teamAbbr: string, weekIndex: number): LeagueGame[] {
  const team = abbr(teamAbbr);
  const sched = GAMES_BY_TEAM.get(team) ?? [];
  const weekOptions = generateWeekOptions(27);
  const w = weekOptions.find(w => w.value === weekIndex);
  if (!w) return [];
  const start = new Date(w.start);
  const end = new Date(w.end);
  start.setUTCHours(0,0,0,0);
  end.setUTCHours(23,59,59,999);

  return sched.filter(g => {
    const t = new Date(g.date).getTime();
    return t >= start.getTime() && t <= end.getTime();
  });
}

export function getLeagueGamesOnDays(teamAbbr: string, weekIndex: number, days: DayAbbr[]): LeagueGame[] {
  const allowed = new Set(days.map(d => DAY_INDEX[d]));
  return getLeagueGamesThisWeek(teamAbbr, weekIndex).filter(g => allowed.has(isoToDow(g.date)));
}

export function getNextOpponentFromLeague(teamAbbr: string): string | '' {
  const team = abbr(teamAbbr);
  const sched = GAMES_BY_TEAM.get(team) ?? [];
  const now = Date.now();
  const next = sched.find(g => new Date(g.date).getTime() >= now);
  if (!next) return '';
  const isHome = abbr(next.home_team) === team;
  const opponent = isHome ? abbr(next.away_team) : abbr(next.home_team);
  return opponent;
}
