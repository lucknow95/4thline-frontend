// src/app/api/unsubscribe/route.ts
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ListType = "newsletter" | "merch";
const isList = (v: unknown): v is ListType => v === "newsletter" || v === "merch";

function destFor(list: ListType, status: "success" | "invalid" | "error") {
    return `/${list}/unsubscribe?status=${status}`;
}

function isLikelyToken(token: unknown): token is string {
    return (
        typeof token === "string" &&
        token.length >= 16 &&
        /^[A-Za-z0-9_-]+$/.test(token)
    );
}

function isEmail(v: unknown): v is string {
    return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

async function unsubscribeByToken(list: ListType, token: string): Promise<"success" | "invalid"> {
    // Flip status if not already unsubscribed
    await db(
        `
      UPDATE subscribers
         SET status = 'unsubscribed',
             unsubscribed_at = NOW()
       WHERE unsub_token = $1
         AND list = $2
         AND status <> 'unsubscribed'
    `,
        [token, list]
    );

    // Consider success if a matching row exists at all (idempotent UX)
    const rows = await db<{ exists: boolean }>(
        `
      SELECT TRUE AS exists
        FROM subscribers
       WHERE unsub_token = $1
         AND list = $2
       LIMIT 1
    `,
        [token, list]
    );

    return rows.length > 0 ? "success" : "invalid";
}

async function unsubscribeByEmail(list: ListType, email: string): Promise<"success" | "invalid"> {
    await db(
        `
      UPDATE subscribers
         SET status = 'unsubscribed',
             unsubscribed_at = NOW()
       WHERE LOWER(email) = LOWER($1)
         AND list = $2
         AND status <> 'unsubscribed'
    `,
        [email, list]
    );

    const rows = await db<{ exists: boolean }>(
        `
      SELECT TRUE AS exists
        FROM subscribers
       WHERE LOWER(email) = LOWER($1)
         AND list = $2
       LIMIT 1
    `,
        [email, list]
    );

    return rows.length > 0 ? "success" : "invalid";
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const listParam = (url.searchParams.get("list") || "newsletter").toLowerCase();
    const list = (isList(listParam) ? listParam : "newsletter") as ListType;

    const token = url.searchParams.get("token");
    const email = url.searchParams.get("email");

    try {
        if (isLikelyToken(token)) {
            const status = await unsubscribeByToken(list, token!);
            return NextResponse.redirect(new URL(destFor(list, status), url), { status: 307 });
        }

        if (isEmail(email)) {
            const status = await unsubscribeByEmail(list, email!);
            return NextResponse.redirect(new URL(destFor(list, status), url), { status: 307 });
        }

        // Nothing usable provided
        return NextResponse.redirect(new URL(destFor(list, "invalid"), url), { status: 307 });
    } catch (err) {
        console.error("unsubscribe GET error", err);
        return NextResponse.redirect(new URL(destFor(list, "error"), url), { status: 307 });
    }
}

// Support one-click List-Unsubscribe-Post POSTs
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
    } catch {
        // ignore; payload stays {}
    }

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
