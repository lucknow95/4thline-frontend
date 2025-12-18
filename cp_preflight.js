require("dotenv").config({ path: process.env.DOTENV_CONFIG_PATH || ".env.local" });
const { Pool } = require("pg");

const url = process.env.DATABASE_URL || process.env.DB_URL;
if (!url) { console.error("Missing DATABASE_URL"); process.exit(1); }

const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function exists(kind, name) {
  if (kind === "table") {
    const r = await pool.query(`select to_regclass('public.${name}') is not null as ok`);
    return r.rows[0].ok;
  } else {
    const r = await pool.query(
      "select exists (select 1 from pg_matviews where schemaname='public' and matviewname=$1) as ok",
      [name]
    );
    return r.rows[0].ok;
  }
}

(async () => {
  console.log("Connecting…");
  await pool.query("select 1");

  const hasRaw = await exists("table", "cp_team_hits");
  const hasAgg = await exists("matview", "cp_team_hits_agg");

  console.log("cp_team_hits (table):", hasRaw ? "OK" : "MISSING");
  console.log("cp_team_hits_agg (matview):", hasAgg ? "OK" : "MISSING");

  if (hasRaw) {
    const c1 = await pool.query("select count(*)::int as n from cp_team_hits");
    console.log("cp_team_hits rows:", c1.rows[0].n);
    const s1 = await pool.query("select * from cp_team_hits order by 1 desc limit 5");
    console.log("sample cp_team_hits rows (top 5 by first column):");
    console.table(s1.rows);
  }

  if (hasAgg) {
    const c2 = await pool.query("select count(*)::int as n from cp_team_hits_agg");
    console.log("cp_team_hits_agg rows (before refresh):", c2.rows[0].n);
  }

  await pool.end();
  console.log("✅ DB preflight complete.");
})().catch(e => { console.error(e); process.exit(1); });
