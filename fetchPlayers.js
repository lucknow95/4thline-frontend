const axios = require('axios');
const fs = require('fs');

const MSF_API_KEY = '6bb63c8a-4b18-4c0c-b8c2-184813';

async function fetchNHLPlayers() {
  const url = 'https://api.mysportsfeeds.com/v2.1/pull/nhl/2024-2025-regular/player_stats_totals.json';
  try {
    const response = await axios.get(url, {
      auth: { username: MSF_API_KEY, password: 'MYSPORTSFEEDS' },
    });
    return response.data.playerStatsTotals;
  } catch (error) {
    console.error('Failed to fetch:', error.response?.data || error.message);
    return [];
  }
}

async function main() {
  const msfPlayers = await fetchNHLPlayers();
  fs.writeFileSync('./player_stats.json', JSON.stringify(msfPlayers, null, 2));
  console.log('Saved player_stats.json with', msfPlayers.length, 'players');
}

main();
