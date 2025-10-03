// src/app/api/dev-send/route.ts
import { sendListEmail } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ListType = "newsletter" | "merch";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isEmail = (s: unknown): s is string => typeof s === "string" && emailRe.test(s);
const isList = (s: unknown): s is ListType => s === "newsletter" || s === "merch";

const CORS_HEADERS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*", // tighten to your domain if desired
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-dev-token",
};

function withCors(res: NextResponse) {
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
    res.headers.set("cache-control", "no-store");
    res.headers.set("x-rev", "dev-send-v2");
    return res;
}

function j(body: unknown, status = 200, extra: Record<string, string> = {}) {
    const res = new NextResponse(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json", ...extra },
    });
    return withCors(res);
}

function getTokenFrom(req: NextRequest) {
    const url = new URL(req.url);
    return req.headers.get("x-dev-token") || url.searchParams.get("token") || "";
}

function isAuthorized(req: NextRequest) {
    // dev/preview: open; prod: require DEV_SEND_TOKEN
    if (process.env.NODE_ENV !== "production") return true;
    const required = process.env.DEV_SEND_TOKEN;
    if (!required) return false;
    const provided = getTokenFrom(req);
    return provided === required;
}

function baseUrl() {
    const raw =
        process.env.NEXT_PUBLIC_BASE_URL ||
        process.env.APP_BASE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    // Ensure no trailing slash (simplifies href building)
    return raw.replace(/\/+$/, "");
}

function safePath(path: string) {
    if (!path || typeof path !== "string") return "/";
    if (path.startsWith("//")) return "/";
    return path.startsWith("/") ? path : `/${path}`;
}

async function sendDev(to: string, list: ListType) {
    const subject = `Test broadcast (${list})`;
    const base = baseUrl();

    // Visible body copy with a clickable link that your current unsubscribe page/API can process.
    // We include both list + email to let you fully test the end-to-end flip to "unsubscribed".
    const bodyUnsubHref = `${base}${safePath(
        `/api/unsubscribe?list=${encodeURIComponent(list)}&email=${encodeURIComponent(to)}`
    )}`;

    const text = [
        `This is a test ${list} email from 4th Line Fantasy.`,
        ``,
        `- Confirm headers`,
        `- Try the unsubscribe links`,
        ``,
        `Unsubscribe here: ${bodyUnsubHref}`,
        `Or email: unsubscribe@4thlinefantasy.com`,
    ].join("\n");

    const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;">
      <p>This is a test <strong>${list}</strong> email from 4th Line Fantasy.</p>
      <ul>
        <li>Confirm headers</li>
        <li>Try the unsubscribe links</li>
      </ul>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
      <p style="font-size:12px;color:#6b7280;">
        You can unsubscribe anytime:
        <a href="${bodyUnsubHref}">unsubscribe</a>
        or email
        <a href="mailto:unsubscribe@4thlinefantasy.com?subject=unsubscribe">unsubscribe@4thlinefantasy.com</a>.
      </p>
    </div>
  `;

    // sendListEmail is expected to add the List-* and List-Unsubscribe (+ One-Click) headers.
    // We also pass List-Subscribe here for completeness in the test.
    await sendListEmail({
        to,
        subject,
        text,
        html,
        list,
        headers: {
            "Precedence": "bulk",
            "List-Subscribe": `<${base}/newsletter>, <mailto:subscribe@4thlinefantasy.com?subject=subscribe>`,
        },
        smtpHeaders: {
            "Precedence": "bulk",
        },
    });
}

/* ---------------------------- Handlers ---------------------------- */

export async function OPTIONS() {
    return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(req: NextRequest) {
    if (!isAuthorized(req)) return j({ ok: false, error: "unauthorized" }, 401);

    const { searchParams } = new URL(req.url);
    const to = searchParams.get("to");
    const list = (searchParams.get("list") as ListType) || "newsletter";

    if (!isEmail(to)) return j({ ok: false, error: "Provide ?to=<email>" }, 400);
    if (!isList(list)) return j({ ok: false, error: "list must be 'newsletter' or 'merch'" }, 400);

    try {
        await sendDev(to, list);
        return j({ ok: true, to, list });
    } catch (err: any) {
        console.error("dev-send GET error:", err);
        return j({ ok: false, error: err?.message ?? "send failed" }, 500);
    }
}

export async function POST(req: NextRequest) {
    if (!isAuthorized(req)) return j({ ok: false, error: "unauthorized" }, 401);

    let body: any;
    try {
        body = await req.json();
    } catch {
        return j({ ok: false, error: "Invalid JSON" }, 400);
    }

    const to = body?.to as string | undefined;
    const list = (body?.list as ListType) ?? "newsletter";

    if (!isEmail(to)) return j({ ok: false, error: "Body must include a valid 'to' email" }, 400);
    if (!isList(list)) return j({ ok: false, error: "list must be 'newsletter' or 'merch'" }, 400);

    try {
        await sendDev(to, list);
        return j({ ok: true, to, list });
    } catch (err: any) {
        console.error("dev-send POST error:", err);
        return j({ ok: false, error: err?.message ?? "send failed" }, 500);
    }
}
