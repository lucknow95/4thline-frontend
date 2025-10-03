// src/app/api/subscribe/route.ts
import { confirmLink, sendConfirmEmail, type ListType } from "@/lib/email";
import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reused pg pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

// --- utils ---
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isEmail = (s: unknown): s is string => typeof s === "string" && emailRe.test(s);
const isList = (x: unknown): x is ListType => x === "newsletter" || x === "merch";

type BodyIn = {
  email?: unknown;
  list?: unknown;
  _dryRunEmail?: unknown;
  // optional fields you might add later (kept generic to avoid runtime errors)
  [k: string]: unknown;
};

const baseHeaders = {
  "content-type": "application/json",
  "cache-control": "no-store",
  "x-rev": "subscribe-v4",
  // If you ever need cross-origin (e.g. hitting preview URL from prod), this is safe & minimal.
  // Adjust origin allow-list at a proxy/CDN layer if you want tighter control:
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

function j(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { ...baseHeaders, ...extraHeaders },
  });
}

// --- routes ---
export async function GET() {
  return j({ ok: true, method: "GET", rev: "subscribe-v4" });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: baseHeaders,
  });
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const ua = req.headers.get("user-agent") || null;

    const body = (await req.json().catch(() => ({}))) as BodyIn;
    const emailUnknown = body?.email;
    const listUnknown = body?.list;
    const _dryRunEmail = body?._dryRunEmail === true;

    if (!isEmail(emailUnknown)) return j({ error: "invalid email" }, 400);
    if (!isList(listUnknown)) return j({ error: "invalid list" }, 400);

    const email = String(emailUnknown).trim().toLowerCase();
    const list: ListType = listUnknown;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Idempotency check
      const existing = await client.query<{ status: string }>(
        `select status from subscribers where email = $1 and list = $2 limit 1`,
        [email, list]
      );
      const currentStatus = existing.rows[0]?.status ?? null;

      if (currentStatus === "confirmed") {
        await client.query("COMMIT");
        return j({
          ok: true,
          email,
          list,
          alreadyConfirmed: true,
          sentEmail: false,
          rev: "subscribe-v4",
        });
      }

      // Upsert to pending
      await client.query(
        `
          insert into subscribers (email, list, status, ip, user_agent)
          values ($1, $2, 'pending', $3, $4)
          on conflict (email, list)
          do update set status = 'pending',
                        ip = excluded.ip,
                        user_agent = excluded.user_agent,
                        updated_at = now()
        `,
        [email, list, ip, ua]
      );

      if (_dryRunEmail) {
        await client.query("COMMIT");
        return j({ ok: true, dryRun: true, email, list, rev: "subscribe-v4" });
      }

      // Clear old tokens
      await client.query(`delete from verify_tokens where email = $1 and list = $2`, [email, list]);

      // New token (14 days)
      const token = randomBytes(24).toString("hex");
      await client.query(
        `insert into verify_tokens (email, list, token, expires_at)
         values ($1, $2, $3, now() + interval '14 days')`,
        [email, list, token]
      );

      await client.query("COMMIT");

      const confirmUrl = confirmLink(token, list);

      // Send email (non-fatal if sending fails; token remains valid)
      try {
        await sendConfirmEmail({ to: email, confirmUrl, list });
        return j({ ok: true, email, list, confirmUrl, sentEmail: true, rev: "subscribe-v4" });
      } catch (mailErr: any) {
        // You could optionally log mailErr here
        return j({
          ok: true,
          email,
          list,
          confirmUrl,
          sentEmail: false,
          error: "email_send_failed",
          rev: "subscribe-v4",
        });
      }
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore rollback failures
      }
      throw e;
    } finally {
      client.release();
    }
  } catch (e: any) {
    return j({ error: e?.message ?? String(e) }, 500);
  }
}
