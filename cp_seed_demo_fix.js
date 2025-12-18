require("dotenv").config({ path: process.env.DOTENV_CONFIG_PATH || ".env.local" });
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const season = "2025-26";

// Demo games: date, home team, arena, home hits
const DEMO = [
  ["2025-10-06","BOS","TD Garden",34],
  ["2025-10-06","TOR","Scotiabank Arena",28],
  ["2025-10-07","DET","Little Caesars Arena",31],
  ["2025-10-07","EDM","Rogers Place",25],
  ["2025-10-08","VAN","Rogers Arena",27],
  ["2025-10-08","UTA","Delta Center",26],
  ["2025-10-09","NSH","Bridgestone Arena",33],
  ["2025-10-09","TBL","Amalie Arena",30],
  ["2025-10-10","NYI","UBS Arena",29],
  ["2025-10-10","COL","Ball Arena",24],
];

(async () => {
  console.log(" Inserting demo home rows into cp_team_hits");

  const text = `
    insert into cp_team_hits
      (season, game_date, team_abbr, home_away, arena_name, hits, source)
    values
      ${DEMO.map((_,i)=>`($${i*7+1}, $${i*7+2}, $${i*7+3}, $${i*7+4}, $${i*7+5}, $${i*7+6}, $${i*7+7})`).join(",\n")}
  `;

  const values = DEMO.flatMap(([date, team, arena, hits]) => [
    season,
    date,
    team,
    "H",          // home_away required by your schema
    arena,
    hits,
    "demo",       // source flag (so we can delete later)
  ]);

  const r = await pool.query(text, values);
  console.log("Inserted rows:", r.rowCount);

  const s = await pool.query(`select * from cp_team_hits order by id desc limit 5`);
  console.log("Sample rows:");
  console.table(s.rows);

  await pool.end();
  console.log(" Demo seed complete.");
})().catch(async e => {
  console.error(" Seed error:", e);
  try { await pool.end(); } catch {}
  process.exit(1);
});
