require("dotenv").config({ path: process.env.DOTENV_CONFIG_PATH || ".env.local" });
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// A small set of plausible games with hits
const DEMO_ROWS = [
  // date, home team, opp, arena, home hits
  { game_date: "2025-10-06", team_abbr: "BOS", opponent_abbr: "NYR", arena_name: "TD Garden", home_hits: 34 },
  { game_date: "2025-10-06", team_abbr: "TOR", opponent_abbr: "MTL", arena_name: "Scotiabank Arena", home_hits: 28 },
  { game_date: "2025-10-07", team_abbr: "DET", opponent_abbr: "CHI", arena_name: "Little Caesars Arena", home_hits: 31 },
  { game_date: "2025-10-07", team_abbr: "EDM", opponent_abbr: "CGY", arena_name: "Rogers Place", home_hits: 25 },
  { game_date: "2025-10-08", team_abbr: "VAN", opponent_abbr: "SEA", arena_name: "Rogers Arena", home_hits: 27 },
  { game_date: "2025-10-08", team_abbr: "UTA", opponent_abbr: "LAK", arena_name: "Delta Center", home_hits: 26 },
  { game_date: "2025-10-09", team_abbr: "NSH", opponent_abbr: "DAL", arena_name: "Bridgestone Arena", home_hits: 33 },
  { game_date: "2025-10-09", team_abbr: "TBL", opponent_abbr: "FLA", arena_name: "Amalie Arena", home_hits: 30 },
  { game_date: "2025-10-10", team_abbr: "NYI", opponent_abbr: "NJD", arena_name: "UBS Arena", home_hits: 29 },
  { game_date: "2025-10-10", team_abbr: "COL", opponent_abbr: "MIN", arena_name: "Ball Arena", home_hits: 24 },
].map(r => ({
  ...r,
  season: "2025-26",
  // Provide multiple common column aliases; the insert builder will pick what exists
  date: r.game_date,
  game_date_utc: r.game_date,
  home_team: r.team_abbr,
  team: r.team_abbr,
  opponent: r.opponent_abbr,
  away_team: r.opponent_abbr,
  venue: r.arena_name,
  hits_home: r.home_hits,
  hits: r.home_hits, // if table simply stores "hits" for the home side
  ingest_source: "demo",
  source: "demo",
  seed_tag: "cp-demo",
}));

// Build an INSERT for the intersection of (table columns) ∩ (our row keys)
async function getColumns(table) {
  const q = `
    select column_name
    from information_schema.columns
    where table_schema='public' and table_name=$1
    order by ordinal_position
  `;
  const r = await pool.query(q, [table]);
  return r.rows.map(x => x.column_name);
}

async function smartInsert(table, rows) {
  const cols = new Set(await getColumns(table));
  if (cols.size === 0) throw new Error(`No columns found for ${table}`);

  const keys = Object.keys(rows[0]).filter(k => cols.has(k));
  if (keys.length === 0) throw new Error(`No matching columns between demo rows and ${table}`);

  // Simple check: if table requires an id/primary key with default, we let DB handle it.
  const placeholders = (i) => keys.map((_, j) => `$${i * keys.length + j + 1}`);

  const text = `
    insert into ${table} (${keys.join(", ")})
    values
    ${rows.map((_, i) => `(${placeholders(i).join(", ")})`).join(",\n")}
  `;

  const values = rows.flatMap(r => keys.map(k => r[k]));
  await pool.query(text, values);
  return { keys, count: rows.length };
}

(async () => {
  console.log("🔎 Inspecting cp_team_hits columns…");
  const cols = await getColumns("cp_team_hits");
  console.log("Columns:", cols);

  console.log("➕ Inserting demo rows (tag=demo/seed_tag=cp-demo) …");
  const res = await smartInsert("cp_team_hits", DEMO_ROWS);
  console.log(`Inserted ${res.count} rows using columns:`, res.keys);

  // Show a small sample back
  const s = await pool.query(`select * from cp_team_hits order by 1 desc limit 5`);
  console.log("Sample rows after insert:");
  console.table(s.rows);

  await pool.end();
  console.log("✅ Demo seed complete.");
})().catch(async (e) => {
  console.error("⛔ Seed error:", e.message);
  console.error(e);
  try { await pool.end(); } catch {}
  process.exit(1);
});
