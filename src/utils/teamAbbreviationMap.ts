// src/lib/teamAbbreviationMap.ts (or src/data or src/utils)

export const TEAM_ABBR_MAP: Record<string, string> = {
  WPJ: 'WPG',
  FLO: 'FLA',
  UTA: 'UTM',
  // Add any future mappings here!
};

export function normalizeTeamAbbreviation(input: string): string {
  return TEAM_ABBR_MAP[input] || input;
}
