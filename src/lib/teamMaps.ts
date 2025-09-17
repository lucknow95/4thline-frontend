// src/lib/teamMaps.ts

/** Full official team names -> NHL abbreviations */
export const fullTeamToAbbr: Record<string, string> = {
  'Anaheim Ducks': 'ANA',
  'Boston Bruins': 'BOS',
  'Buffalo Sabres': 'BUF',
  'Calgary Flames': 'CGY',
  'Carolina Hurricanes': 'CAR',
  'Chicago Blackhawks': 'CHI',
  'Colorado Avalanche': 'COL',
  'Columbus Blue Jackets': 'CBJ',
  'Dallas Stars': 'DAL',
  'Detroit Red Wings': 'DET',
  'Edmonton Oilers': 'EDM',
  'Florida Panthers': 'FLA',
  'Los Angeles Kings': 'LAK',
  'Minnesota Wild': 'MIN',
  'Montreal Canadiens': 'MTL',
  'Nashville Predators': 'NSH',
  'New Jersey Devils': 'NJD',
  'New York Islanders': 'NYI',
  'New York Rangers': 'NYR',
  'Ottawa Senators': 'OTT',
  'Philadelphia Flyers': 'PHI',
  'Pittsburgh Penguins': 'PIT',
  'San Jose Sharks': 'SJS',
  'Seattle Kraken': 'SEA',
  'St. Louis Blues': 'STL',
  'Tampa Bay Lightning': 'TBL',
  'Toronto Maple Leafs': 'TOR',
  // Utah: post-relocation placeholder name commonly used in 2025–26
  'Utah Hockey Club': 'UTA',
  'Vancouver Canucks': 'VAN',
  'Vegas Golden Knights': 'VGK',
  'Washington Capitals': 'WSH',
  'Winnipeg Jets': 'WPG',


};

/**
 * City / short labels -> NHL abbreviations.
 * These are the strings most likely to appear in your API’s `home_team` / `away_team` fields.
 */
export const cityToAbbr: Record<string, string> = {
  Anaheim: 'ANA',
  Boston: 'BOS',
  Buffalo: 'BUF',
  Calgary: 'CGY',
  Carolina: 'CAR', // sometimes appears as a region-style label
  Chicago: 'CHI',
  Colorado: 'COL', // appears as "Colorado" in some feeds
  Columbus: 'CBJ',
  Dallas: 'DAL',
  Detroit: 'DET',
  Edmonton: 'EDM',
  Florida: 'FLA', // Panthers sometimes appear as "Florida"
  'Los Angeles': 'LAK',
  Minnesota: 'MIN',
  Montreal: 'MTL',
  Montréal: 'MTL', // accent variant
  Nashville: 'NSH',
  'New Jersey': 'NJD',

  // New York is ambiguous (Rangers/Islanders). Include disambiguators commonly used by feeds.
  'New York Islanders': 'NYI',
  'New York Rangers': 'NYR',
  'NY Islanders': 'NYI',
  'NY Rangers': 'NYR',
  'NYI': 'NYI',
  'NYR': 'NYR',

  Ottawa: 'OTT',
  Philadelphia: 'PHI',
  Pittsburgh: 'PIT',
  'San Jose': 'SJS',
  Seattle: 'SEA',
  'St. Louis': 'STL',
  'Saint Louis': 'STL', // alt spelling
  'Tampa Bay': 'TBL',
  Tampa: 'TBL', // short city alias used by some feeds
  Toronto: 'TOR',
  Utah: 'UTA',
  Vancouver: 'VAN',
  Vegas: 'VGK',
  'Las Vegas': 'VGK', // occasionally appears this way
  Washington: 'WSH',
  Winnipeg: 'WPG',


};

/** Convenience: try full name first, then city/short label */
export function resolveAbbr(name: string): string | null {
  if (!name) return null;
  if (fullTeamToAbbr[name]) return fullTeamToAbbr[name];
  if (cityToAbbr[name]) return cityToAbbr[name];

// Light fallback: try first word as a city hint (e.g., "Colorado Avalanche" -> "Colorado")
const firstWord = name.trim().split(/\s+/)[0] ?? '';
if (firstWord && cityToAbbr[firstWord]) {
  return cityToAbbr[firstWord];
}

  return null;
}
