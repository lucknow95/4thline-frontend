const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const t  = await pool.query("select table_name from information_schema.tables where table_schema='public' order by 1");
  console.table(t.rows);
  const v  = await pool.query("select table_name from information_schema.views  where table_schema='public' order by 1");
  console.table(v.rows);
  const mv = await pool.query("select matviewname as table_name from pg_matviews where schemaname='public' order by 1");
  console.table(mv.rows);
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
