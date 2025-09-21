// src/app/api/subscribe/route.ts
import { sendConfirmEmail } from "@/lib/email";
import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ListType = "newsletter" | "merch";
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- helpers ----------
const ok = (b: unknown, i?: number | ResponseInit) => NextResponse.json(b, typeof i === "number" ? { status: i } : i);
const bad = (b: unknown, s = 400) => NextResponse.json(b, { status: s });
const token = (n = 24) => randomBytes(n).toString("hex");

function baseUrl(): string {
  const a = process.env.APP_BASE_URL?.trim();
  const b = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  const c = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  for (const cand of [a, b, c, "http://localhost:3000"]) {
    if (!cand) continue;
    try { return new URL(cand).toString().replace(/\/+$/, ""); } catch { }
  }
  return "http://localhost:3000";
}

// ---------- PG pool ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

// ---------- GET /api/subscribe?diag=1 (safe diagnostics) ----------
export async function GET(req: NextRequest) {
  const diag = req.nextUrl.searchParams.get("diag");
  if (!diag) return bad({ error: "Method not allowed" }, 405);

  return ok({
    ok: true,
    env: {
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
      EMAIL_FROM: Boolean(process.env.EMAIL_FROM),
      APP_BASE_URL: process.env.APP_BASE_URL ?? null,
      VERCEL_URL: process.env.VERCEL_URL ?? null,
    },
  });
}

// ---------- POST ----------
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      list?: ListType;
      sourcePath?: string | null;
      _dryRunEmail?: boolean; // set true to skip sending email while debugging
    };

    const email = (body.email ?? "").trim().toLowerCase();
    const list = body.list;
    if (!emailRe.test(email)) return bad({ error: "Invalid email" }, 400);
    if (list !== "newsletter" && list !== "merch") return bad({ error: "Invalid list" }, 400);

    // Env checks (clear messages)
    if (!process.env.DATABASE_URL) return bad({ error: "Missing DATABASE_URL" }, 500);
    if (!process.env.EMAIL_FROM) return bad({ error: "Missing EMAIL_FROM" }, 500);
    if (!process.env.RESEND_API_KEY && !body._dryRunEmail) {
      return bad({ error: "Missing RESEND_API_KEY" }, 500);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        CREATE TABLE IF NOT EXISTS subscribers (
          id BIGSERIAL PRIMARY KEY,
          email TEXT NOT NULL,
          list  TEXT NOT NULL CHECK (list IN ('newsletter','merch')),
          confirmed BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(email, list)
        );
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS verify_tokens (
          token TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          list  TEXT NOT NULL CHECK (list IN ('newsletter','merch')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await client.query(
        `INSERT INTO subscribers (email, list, confirmed)
         VALUES ($1,$2,false)
         ON CONFLICT (email, list) DO UPDATE SET confirmed=false`,
        [email, list]
      );

      await client.query(`DELETE FROM verify_tokens WHERE email=$1 AND list=$2`, [email, list]);
      const t = token();
      await client.query(
        `INSERT INTO verify_tokens (token, email, list) VALUES ($1,$2,$3)`,
        [t, email, list]
      );

      await client.query("COMMIT");

      const base = baseUrl();
      const path = list === "merch" ? "merch" : "newsletter";
      const confirmUrl = `${base}/${path}/confirmed?confirmed=1&token=${t}`;

      const sendEmails = (process.env.SEND_EMAILS ?? "true") !== "false" && !body._dryRunEmail;
      if (sendEmails) {
        try {
          await sendConfirmEmail(email, confirmUrl, list as ListType);
        } catch (e: any) {
          console.error("sendConfirmEmail error", e);
          const msg = e?.message?.includes("Sender identity")
            ? "Email sender identity not verified"
            : (e?.message || "Email send failed");
          return bad({ error: msg }, 500);
        }
      }

      return ok({ ok: true, confirmUrl, sentEmail: !!sendEmails });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("subscribe tx error", err);
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("subscribe fatal", err);
    const msg =
      err?.code === "ENOTFOUND" ? "Database host not reachable" :
        err?.code === "28P01" ? "Database authentication failed" :
          typeof err?.message === "string" ? err.message : "Unknown error";
    return bad({ error: msg }, 500);
  }
}
