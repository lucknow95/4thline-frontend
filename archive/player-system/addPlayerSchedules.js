const fs = require('fs');

// Adjust paths as needed
const realPlayers = require('./src/data/realPlayers.json');
const nhlSchedule = require('./src/data/nhlSchedule.json');

// Team abbreviation mapping (same as app)
const TEAM_ABBR_MAP = {
  "Anaheim Ducks": "ANA", "Anaheim": "ANA", "ANA": "ANA",
  "Boston Bruins": "BOS", "Boston": "BOS", "BOS": "BOS",
  "Buffalo Sabres": "BUF", "Buffalo": "BUF", "BUF": "BUF",
  "Calgary Flames": "CGY", "Calgary": "CGY", "CGY": "CGY",
  "Carolina Hurricanes": "CAR", "Carolina": "CAR", "CAR": "CAR",
  "Chicago Blackhawks": "CHI", "Chicago": "CHI", "CHI": "CHI",
  "Colorado Avalanche": "COL", "Colorado": "COL", "COL": "COL",
  "Columbus Blue Jackets": "CBJ", "Columbus": "CBJ", "CBJ": "CBJ",
  "Dallas Stars": "DAL", "Dallas": "DAL", "DAL": "DAL",
  "Detroit Red Wings": "DET", "Detroit": "DET", "DET": "DET",
  "Edmonton Oilers": "EDM", "Edmonton": "EDM", "EDM": "EDM",
  "Florida Panthers": "FLA", "Florida": "FLA", "FLA": "FLA", "FLO": "FLA",
  "Los Angeles Kings": "LAK", "Los Angeles": "LAK", "LAK": "LAK",
  "Minnesota Wild": "MIN", "Minnesota": "MIN", "MIN": "MIN",
  "Montreal Canadiens": "MTL", "Montreal": "MTL", "MTL": "MTL",
  "Nashville Predators": "NSH", "Nashville": "NSH", "NSH": "NSH",
  "New Jersey Devils": "NJD", "New Jersey": "NJD", "NJD": "NJD",
  "New York Islanders": "NYI", "New York": "NYI", "NYI": "NYI",
  "New York Rangers": "NYR", "NYR": "NYR",
  "Ottawa Senators": "OTT", "Ottawa": "OTT", "OTT": "OTT",
  "Philadelphia Flyers": "PHI", "Philadelphia": "PHI", "PHI": "PHI",
  "Pittsburgh Penguins": "PIT", "Pittsburgh": "PIT", "PIT": "PIT",
  "San Jose Sharks": "SJS", "San Jose": "SJS", "SJS": "SJS",
  "Seattle Kraken": "SEA", "Seattle": "SEA", "SEA": "SEA",
  "St. Louis Blues": "STL", "St. Louis": "STL", "STL": "STL",
  "Tampa Bay Lightning": "TBL", "Tampa Bay": "TBL", "TBL": "TBL",
  "Toronto Maple Leafs": "TOR", "Toronto": "TOR", "TOR": "TOR",
  "Vancouver Canucks": "VAN", "Vancouver": "VAN", "VAN": "VAN",
  "Vegas Golden Knights": "VGK", "Vegas": "VGK", "VGK": "VGK",
  "Washington Capitals": "WSH", "Washington": "WSH", "WSH": "WSH",
  "Winnipeg Jets": "WPG", "Winnipeg": "WPG", "WPG": "WPG", "WPJ": "WPG",
  "Utah Mammoth": "UTM", "Utah": "UTM", "UTM": "UTM", "UTA": "UTM",
};

function normalizeTeamAbbr(input) {
  return TEAM_ABBR_MAP[input] || input;
}

const scheduleByAbbr = {};
nhlSchedule.forEach(teamObj => {
  scheduleByAbbr[normalizeTeamAbbr(teamObj.team)] = teamObj.schedule;
});

const newPlayers = realPlayers.map(player => {
  const abbr = normalizeTeamAbbr(player.team);
  const schedule = scheduleByAbbr[abbr] || [];
  return { ...player, schedule };
});

fs.writeFileSync('./src/data/realPlayersWithSchedule.json', JSON.stringify(newPlayers, null, 2));
console.log('Done! Saved ./src/data/realPlayersWithSchedule.json');
