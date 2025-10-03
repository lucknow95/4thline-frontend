// src/app/api/unsubscribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

type ListType = "newsletter" | "merch";
const isList = (v: unknown): v is ListType => v === "newsletter" || v === "merch";

function destFor(list: ListType, status: "success" | "invalid" | "error") {
    const base = list === "merch" ? "/merch/confirmed" : "/newsletter/confirmed";
    return `${base}?${status === "success" ? "unsub=1" : `status=${status}`}`;
}

function isLikelyToken(token: unknown): token is string {
    return typeof token === "string" && token.length >= 16 && /^[A-Za-z0-9_-]+$/.test(token);
}
function isEmail(v: unknown): v is string {
    return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function pickSafeRedirect(baseUrl: URL, fallbackPath: string, hinted?: string | null) {
    if (typeof hinted !== "string" || hinted.length === 0) return new URL(fallbackPath, baseUrl);
    if (hinted.startsWith("http://") || hinted.startsWith("https://") || hinted.startsWith("//")) {
        return new URL(fallbackPath, baseUrl);
    }
    const path = hinted.startsWith("/") ? hinted : `/${hinted}`;
    return new URL(path, baseUrl);
}

async function unsubscribeByToken(list: ListType, token: string): Promise<"success" | "invalid"> {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const found = await client.query<{ email: string; list: ListType }>(
            `
      select email, list
        from unsub_tokens
       where token = $1
         and (expires_at is null or expires_at > now())
       limit 1
      `,
            [token]
        );
        const row = found.rows[0];
        if (!row || row.list !== list) {
            await client.query("ROLLBACK");
            return "invalid";
        }

        await client.query(
            `
      update subscribers
         set status = 'unsubscribed',
             unsubscribed_at = now()
       where lower(email) = lower($1)
         and list = $2
      `,
            [row.email, list]
        );

        await client.query(`update unsub_tokens set used_at = now() where token = $1`, [token]);
        await client.query(`delete from unsub_tokens where token = $1`, [token]);

        await client.query("COMMIT");
        return "success";
    } catch {
        try { await pool.query("ROLLBACK"); } catch { }
        return "invalid";
    } finally {
        client.release();
    }
}

async function unsubscribeByEmail(list: ListType, email: string): Promise<"success" | "invalid"> {
    const res = await pool.query(
        `
    update subscribers
       set status = 'unsubscribed',
           unsubscribed_at = now()
     where lower(email) = lower($1)
       and list = $2
    `,
        [email, list]
    );

    // rowCount can be number | null per pg types — coalesce safely
    const rowCount = typeof res.rowCount === "number" ? res.rowCount : 0;
    return rowCount > 0 ? "success" : "invalid";
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const listParam = (url.searchParams.get("list") || "newsletter").toLowerCase();
    const list = (isList(listParam) ? listParam : "newsletter") as ListType;

    const token = url.searchParams.get("token");
    const email = url.searchParams.get("email");
    const hintedRedirect = url.searchParams.get("redirect");

    try {
        if (isLikelyToken(token)) {
            const status = await unsubscribeByToken(list, token!);
            const location = pickSafeRedirect(url, destFor(list, status), hintedRedirect);
            return NextResponse.redirect(location, { status: 307 });
        }
        if (isEmail(email)) {
            const status = await unsubscribeByEmail(list, email!);
            const location = pickSafeRedirect(url, destFor(list, status), hintedRedirect);
            return NextResponse.redirect(location, { status: 307 });
        }
        const location = pickSafeRedirect(url, destFor(list, "invalid"), hintedRedirect);
        return NextResponse.redirect(location, { status: 307 });
    } catch (err) {
        console.error("unsubscribe GET error", err);
        const location = pickSafeRedirect(url, destFor(list, "error"), hintedRedirect);
        return NextResponse.redirect(location, { status: 307 });
    }
}

export async function POST(req: NextRequest) {
    let payload: Record<string, any> = {};
    try {
        const ctype = req.headers.get("content-type") || "";
        if (ctype.includes("application/json")) {
            payload = await req.json();
        } else if (ctype.includes("application/x-www-form-urlencoded")) {
            const form = await req.formData();
            payload = Object.fromEntries(form.entries());
        }
    } catch { }

    const listParam = (payload.list ?? payload.List ?? "newsletter").toLowerCase();
    const list = (isList(listParam) ? listParam : "newsletter") as ListType;

    const token = payload.token ?? payload.Token;
    const email = payload.email ?? payload.Email;

    try {
        if (isLikelyToken(token)) {
            const status = await unsubscribeByToken(list, token);
            return status === "success"
                ? NextResponse.json({ ok: true })
                : NextResponse.json({ ok: false }, { status: 400 });
        }
        if (isEmail(email)) {
            const status = await unsubscribeByEmail(list, email);
            return status === "success"
                ? NextResponse.json({ ok: true })
                : NextResponse.json({ ok: false }, { status: 400 });
        }
        return NextResponse.json({ ok: false, error: "missing token/email" }, { status: 400 });
    } catch (err) {
        console.error("unsubscribe POST error", err);
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
