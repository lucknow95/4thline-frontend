// src/app/api/merch-waitlist/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ----------------------------- Config / helpers ---------------------------- */

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CORS_HEADERS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*", // change to your domain if you need stricter CORS
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, init?: number | ResponseInit) {
    const opts: ResponseInit | undefined = typeof init === "number" ? { status: init } : init;
    const res = NextResponse.json(body, opts);
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
    return res;
}

/* --------------------------------- PG pool -------------------------------- */

if (!process.env.DATABASE_URL) {
    // Fail fast in prod; still allows local dev without env by throwing on use
    console.error("ENV MISSING: DATABASE_URL");
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

/* ---------------------------------- Types --------------------------------- */

type Body = {
    email?: string;
    source?: string | null; // optional metadata (e.g. "merch_page")
};

/* --------------------------------- OPTIONS -------------------------------- */

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/* ----------------------------------- POST --------------------------------- */

export async function POST(req: NextRequest) {
    try {
        if (!process.env.DATABASE_URL) {
            return json({ ok: false, error: "Missing DATABASE_URL" }, 500);
        }

        const body = (await req.json().catch(() => ({}))) as Body;

        // Normalize & validate email
        const rawEmail = (body.email ?? "").trim();
        const email = rawEmail.toLowerCase();
        if (!email || email.length > 254 || !emailRe.test(email)) {
            return json({ ok: false, error: "Please enter a valid email address." }, 400);
        }

        // Optional metadata
        let source = (body.source ?? "merch_page").trim();
        if (source.length > 128) source = source.slice(0, 128);

        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
        const ua = req.headers.get("user-agent") ?? null;

        const client = await pool.connect();
        try {
            // Ensure table exists (idempotent)
            await client.query(`
        CREATE TABLE IF NOT EXISTS merch_waitlist (
          email       TEXT PRIMARY KEY,
          status      TEXT NOT NULL DEFAULT 'active',
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          source      TEXT,
          ip          TEXT,
          user_agent  TEXT
        );
      `);

            // Upsert by email (idempotent)
            await client.query(
                `
          INSERT INTO merch_waitlist (email, status, source, ip, user_agent)
          VALUES ($1, 'active', $2, $3, $4)
          ON CONFLICT (email) DO UPDATE
          SET status = EXCLUDED.status,
              source = EXCLUDED.source,
              ip = EXCLUDED.ip,
              user_agent = EXCLUDED.user_agent,
              updated_at = NOW();
        `,
                [email, source, ip, ua]
            );

            return json({ ok: true, email, status: "active" }, 200);
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error("merch-waitlist error", err);
        // Return a more helpful, but safe, error
        let msg = "Unexpected error.";
        if (err?.code === "ENOTFOUND") msg = "Database host not reachable.";
        else if (err?.code === "28P01") msg = "Database authentication failed.";
        else if (typeof err?.message === "string") msg = err.message;

        return json({ ok: false, error: msg }, 500);
    }
}
