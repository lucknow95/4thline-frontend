const fs = require('fs');

const filePath = './realPlayers.json';

const ABBR_MAP = {
  'WPJ': 'WPG',
  'FLO': 'FLA',
  'UTA': 'UTM'
};

const raw = fs.readFileSync(filePath, 'utf-8');
const data = JSON.parse(raw);

data.forEach(player => {
  if (ABBR_MAP[player.team]) {
    player.team = ABBR_MAP[player.team];
  }
});

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log('Abbreviations fixed!');
