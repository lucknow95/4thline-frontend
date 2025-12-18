require("dotenv").config({ path: process.env.DOTENV_CONFIG_PATH || ".env.local" });
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function sample(name) {
  const r = await pool.query(`select * from ${name} limit 10`);
  console.log(`\n=== ${name} (10 rows) ===`);
  console.table(r.rows);
}

(async () => {
  await sample("cp_team_hits");
  await sample("cp_team_hits_agg");
  await pool.end();
  console.log("\n✅ Front-end contract smoke OK");
})().catch(e => { console.error(e); process.exit(1); });
