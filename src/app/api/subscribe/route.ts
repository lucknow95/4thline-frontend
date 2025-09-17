// src/app/api/subscribe/route.ts
import { sendConfirmEmail } from "@/lib/email"; // (to, confirmUrl, list)
import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

type ListType = "newsletter" | "merch";

type Body = {
  email?: string;
  list?: ListType;
  sourcePath?: string | null;   // optional page where the user started (used only for analytics/redirect hints)
  country?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
};

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isEmail = (s: unknown): s is string => typeof s === "string" && emailRe.test(s);
const isList = (s: unknown): s is ListType => s === "newsletter" || s === "merch";

function json(data: unknown, init?: number | ResponseInit) {
  if (typeof init === "number") return NextResponse.json(data, { status: init });
  return NextResponse.json(data, init);
}

const token = () => randomBytes(20).toString("hex");

function getBaseUrl(req: NextRequest) {
  const proto = (req.headers.get("x-forwarded-proto") || "").split(",")[0]?.trim() || "http";
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000") as string;
  return `${proto}://${host}`;
}

export async function GET() {
  return json({ ok: true, route: "subscribe" }, 200);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const {
      email,
      list,
      sourcePath = null,
      country = null,
      utm_source = null,
      utm_medium = null,
      utm_campaign = null,
    } = body || {};

    if (!isEmail(email)) return json({ ok: false, error: "Invalid email." }, 400);
    if (!isList(list)) return json({ ok: false, error: "Invalid list." }, 400);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const ua = req.headers.get("user-agent") || null;

    const t = token();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `insert into verify_tokens
          (email, token, list, ip, ua, source_path, country, utm_source, utm_medium, utm_campaign)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [email, t, list, ip, ua, sourcePath, country, utm_source, utm_medium, utm_campaign],
      );

      await client.query(
        `insert into subscribers (email, list, status)
         values ($1,$2,'pending')
         on conflict (email, list) do update set status='pending'`,
        [email, list],
      );

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    // Build confirm URL that hits your confirm API, which should handle the token
    // and then redirect to your friendly confirmation page.
    // Example confirm API route: /api/confirm-subscription
    const base = getBaseUrl(req);
    const qp = new URLSearchParams({ token: t, list });
    if (sourcePath) qp.set("redirect", sourcePath); // optional hint for where to send users after confirm
    const confirmUrl = `${base}/api/confirm-subscription?${qp.toString()}`;

    // Send the confirmation email
    const result = await sendConfirmEmail(email, confirmUrl, list);

    // Expose message id while developing to help with troubleshooting
    const resendId = (result as any)?.data?.id ?? null;

    return json(
      {
        ok: true,
        message: "Check your email to confirm.",
        ...(process.env.NODE_ENV !== "production" ? { resendId } : {}),
      },
      200,
    );
  } catch (err: any) {
    const message =
      process.env.NODE_ENV === "development" ? String(err?.message || err) : "Something went wrong.";
    return json({ ok: false, error: message }, 500);
  }
}
