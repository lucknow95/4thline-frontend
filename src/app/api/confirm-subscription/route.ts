// src/app/api/confirm-subscription/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

type ListType = "newsletter" | "merch";

function absoluteRedirect(req: NextRequest, path: string, status: 301 | 302 = 302) {
  const proto = (req.headers.get("x-forwarded-proto") || "").split(",")[0]?.trim() || "http";
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000").toString();
  return NextResponse.redirect(`${proto}://${host}${path}`, { status });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = (url.searchParams.get("token") || "").trim();

  // Friendly fallback for missing token
  if (!token) {
    return absoluteRedirect(req, "/newsletter/confirmed?error=invalid");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Look up token (token-only flow)
    const { rows } = await client.query<{
      email: string;
      list: ListType;
      created_at: string | null;
    }>(
      `SELECT email, list, created_at
         FROM verify_tokens
        WHERE token = $1
        LIMIT 1`,
      [token],
    );

    const row = rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return absoluteRedirect(req, "/newsletter/confirmed?error=invalid");
    }

    const email = row.email;
    const list: ListType = row.list === "merch" ? "merch" : "newsletter";

    // 2) Confirm subscriber (idempotent)
    await client.query(
      `INSERT INTO subscribers (email, list, status, confirmed_at)
       VALUES ($1, $2, 'confirmed', NOW())
       ON CONFLICT (email, list)
       DO UPDATE SET status = 'confirmed', confirmed_at = NOW()`,
      [email, list],
    );

    // Optional: mark token used if you later add a used_at column
    // await client.query(`UPDATE verify_tokens SET used_at = NOW() WHERE token = $1`, [token]);

    await client.query("COMMIT");

    // 3) Friendly redirects
    if (list === "merch") {
      return absoluteRedirect(req, "/merch/confirmed");
    }
    // newsletter
    return absoluteRedirect(req, "/newsletter/confirmed?confirmed=1");
  } catch (err) {
    await client.query("ROLLBACK");
    if (process.env.NODE_ENV !== "production") {
      console.error("[confirm-subscription] error:", err);
    }
    // Friendly error page
    return absoluteRedirect(req, "/newsletter/confirmed?error=unknown");
  } finally {
    client.release();
  }
}
