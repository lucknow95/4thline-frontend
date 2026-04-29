const fs = require('fs');

// Read in raw data from fetchPlayers.js
const rawData = JSON.parse(fs.readFileSync('./player_stats.json', 'utf-8'));

// Helper: convert position codes to your app's format if needed
function parsePositions(player) {
  // Try to get all position eligibilities (may need to improve for your provider)
  const all = [];
  if (player.primaryPosition) all.push(player.primaryPosition);
  if (player.position && !all.includes(player.position)) all.push(player.position);
  if (player.otherPositions && Array.isArray(player.otherPositions)) {
    player.otherPositions.forEach(pos => {
      if (!all.includes(pos)) all.push(pos);
    });
  }
  return all.length > 0 ? all : ['C']; // Default to 'C' if nothing found
}

const normalized = rawData.map(obj => {
  const p = obj.player;
  const s = obj.stats;

  return {
    id: p.id,
    name: `${p.firstName} ${p.lastName}`,
    team: p.currentTeam?.abbreviation || '',
    positions: parsePositions(p),
    stats: {
      Season: {
        G: s.offense?.goals || 0,
        A: s.offense?.assists || 0,
        PIM: s.offense?.penaltyMinutes || 0,
        PPP: (s.specialTeams?.powerplayPoints || 0) +
             (s.specialTeams?.powerplayAssists || 0), // (or split if needed)
        SHP: s.specialTeams?.shorthandedPoints || 0,
        SOG: s.offense?.shots || 0,
        FW: s.faceoffs?.faceoffWins || 0,
        HIT: s.miscellaneous?.hits || 0,
        BLK: s.miscellaneous?.blockedShots || 0,
        gamesPlayed: s.gamesPlayed || 0
      }
    }
  };
});

// Optional: filter out players with 0 GP and no team (usually unsigned/AHL etc)
const filtered = normalized.filter(p => p.team && p.stats.Season.gamesPlayed > 0);

fs.writeFileSync('./realPlayers.json', JSON.stringify(filtered, null, 2));
console.log('Saved realPlayers.json with', filtered.length, 'players');
