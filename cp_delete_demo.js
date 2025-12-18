require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const r = await p.query("delete from cp_team_hits where source='demo'");
  console.log("Deleted demo rows:", r.rowCount);
  await p.end();
})().catch(async e => { console.error(e); try { await p.end(); } catch {}; process.exit(1); });
