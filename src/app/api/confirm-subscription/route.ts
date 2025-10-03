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
const isList = (s: unknown): s is ListType => s === "newsletter" || s === "merch";

function absoluteRedirect(req: NextRequest, path: string, status: 301 | 302 = 302) {
  const safePath = (() => {
    if (!path || typeof path !== "string") return "/newsletter/confirmed?error=invalid";
    if (path.startsWith("//")) return "/newsletter/confirmed?error=invalid";
    return path.startsWith("/") ? path : `/${path}`;
  })();

  const proto = (req.headers.get("x-forwarded-proto") || "").split(",")[0]?.trim() || "http";
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000").toString();

  return NextResponse.redirect(`${proto}://${host}${safePath}`, { status });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = (url.searchParams.get("token") || "").trim();
  const hintedList = url.searchParams.get("list");
  const hintedRedirect = url.searchParams.get("redirect");

  if (!token) return absoluteRedirect(req, "/newsletter/confirmed?error=invalid");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // look up token with expiry check
    const { rows } = await client.query<{ email: string; list: ListType }>(
      `
      select email, list
        from verify_tokens
       where token = $1
         and (expires_at is null or expires_at > now())
       limit 1
      `,
      [token]
    );

    const row = rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return absoluteRedirect(req, "/newsletter/confirmed?error=invalid");
    }

    const email = row.email;
    const list: ListType = isList(row.list) ? row.list : (isList(hintedList) ? hintedList : "newsletter");

    await client.query(
      `
      insert into subscribers (email, list, status, confirmed_at)
      values ($1, $2, 'confirmed', now())
      on conflict (email, list)
      do update set status = 'confirmed', confirmed_at = now()
      `,
      [email, list]
    );

    // optional audit: mark used, then delete
    await client.query(`update verify_tokens set used_at = now() where token = $1`, [token]);
    await client.query(`delete from verify_tokens where token = $1`, [token]);

    await client.query("COMMIT");

    const defaultRedirect = list === "merch"
      ? "/merch/confirmed?confirmed=1"
      : "/newsletter/confirmed?confirmed=1";

    const nextPath =
      hintedRedirect && hintedRedirect.startsWith("/") && !hintedRedirect.startsWith("//")
        ? hintedRedirect
        : defaultRedirect;

    return absoluteRedirect(req, nextPath);
  } catch (err) {
    await client.query("ROLLBACK");
    if (process.env.NODE_ENV !== "production") console.error("[confirm-subscription] error:", err);
    return absoluteRedirect(req, "/newsletter/confirmed?error=unknown");
  } finally {
    client.release();
  }
}
