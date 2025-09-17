import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

// Node runtime for pg
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reuse a single pool across invocations
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

// Simple email validator
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = {
    email?: string;
    source?: string | null;
};

// FIX: convert `number` to `{ status: number }` before passing to NextResponse.json
function json(res: unknown, init?: number | ResponseInit) {
    const options: ResponseInit | undefined =
        typeof init === "number" ? { status: init } : init;
    return NextResponse.json(res, options);
}

// (Optional) handle CORS preflight if you ever call this from a different origin.
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    });
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json().catch(() => ({}))) as Body;

        // Normalize & validate email
        const rawEmail = (body.email ?? "").trim();
        const email = rawEmail.toLowerCase();
        if (!email || email.length > 254 || !emailRe.test(email)) {
            return json({ ok: false, error: "Please enter a valid email address." }, 400);
        }

        // optional source for analytics/debug
        let source = (body.source ?? "merch_page").trim();
        if (source.length > 128) source = source.slice(0, 128);

        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
        const ua = req.headers.get("user-agent") ?? null;

        const client = await pool.connect();
        try {
            // Ensure table exists (idempotent)
            await client.query(`
        CREATE TABLE IF NOT EXISTS merch_waitlist (
          email TEXT PRIMARY KEY,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          source TEXT,
          ip TEXT,
          user_agent TEXT
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
    } catch (err) {
        console.error("merch-waitlist error", err);
        return json({ ok: false, error: "Unexpected error." }, 500);
    }
}
