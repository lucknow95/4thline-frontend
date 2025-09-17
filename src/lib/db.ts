// src/lib/db.ts
import { Pool, type QueryResultRow } from 'pg';

// Keep a single pool across hot reloads in dev
const globalForPool = globalThis as unknown as { pool?: Pool };

export const pool =
    globalForPool.pool ??
    new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes('localhost')
            ? false
            : { rejectUnauthorized: false },
    });

if (process.env.NODE_ENV !== 'production') globalForPool.pool = pool;

// Generic query helper (T must extend QueryResultRow)
export async function db<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: any[]
): Promise<T[]> {
    const res = await pool.query<T>(text, params);
    return res.rows;
}
