// src/app/api/dev-send/route.ts
import { sendListEmail } from "@/lib/email"; // assumes your helper already sets List-* headers, DKIM, etc.
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// very light email check (good enough for a dev endpoint)
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type ListType = "newsletter" | "merch";

function isEmail(s: unknown): s is string {
    return typeof s === "string" && emailRe.test(s);
}
function isList(s: unknown): s is ListType {
    return s === "newsletter" || s === "merch";
}

// Shared payload builder: sends BOTH text and HTML + visible unsubscribe links
async function sendDev(to: string, list: ListType) {
    const subject = `Test broadcast (${list})`;

    const text = `This is a test ${list} email from 4th Line Fantasy.

- Confirm headers
- Try the unsubscribe links

Unsubscribe here: ${process.env.NEXT_PUBLIC_BASE_URL ?? "https://4thlinefantasy.com"}/api/unsubscribe?list=${list}
Or email: unsubscribe@4thlinefantasy.com
`;

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://4thlinefantasy.com";
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
        <a href="${baseUrl}/api/unsubscribe?list=${list}">unsubscribe</a>
        or email
        <a href="mailto:unsubscribe@4thlinefantasy.com?subject=unsubscribe">unsubscribe@4thlinefantasy.com</a>.
      </p>
    </div>
  `;

    // Optional niceties: if your sendListEmail supports custom headers, you can pass them here.
    // These are harmless if your helper ignores them.
    const additionalHeaders: Record<string, string> = {
        "Precedence": "bulk",
        "List-Subscribe": `<${baseUrl}/newsletter>, <mailto:subscribe@4thlinefantasy.com?subject=subscribe>`,
    };

    await sendListEmail({
        to,
        subject,
        text,
        html,
        list,
    });

}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const to = searchParams.get("to");
    const list = (searchParams.get("list") as ListType) || "newsletter";

    if (!isEmail(to)) {
        return NextResponse.json({ ok: false, error: "Provide ?to=<email>" }, { status: 400 });
    }
    if (!isList(list)) {
        return NextResponse.json({ ok: false, error: "list must be 'newsletter' or 'merch'" }, { status: 400 });
    }

    try {
        await sendDev(to, list);
        return NextResponse.json({ ok: true, to, list });
    } catch (err: any) {
        console.error("dev-send error:", err);
        return NextResponse.json({ ok: false, error: err?.message ?? "send failed" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    // also allow JSON body: { to: string, list?: "newsletter" | "merch" }
    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    const to = body?.to as string | undefined;
    const list = (body?.list as ListType) ?? "newsletter";

    if (!isEmail(to)) {
        return NextResponse.json({ ok: false, error: "Body must include a valid 'to' email" }, { status: 400 });
    }
    if (!isList(list)) {
        return NextResponse.json({ ok: false, error: "list must be 'newsletter' or 'merch'" }, { status: 400 });
    }

    try {
        await sendDev(to, list);
        return NextResponse.json({ ok: true, to, list });
    } catch (err: any) {
        console.error("dev-send error:", err);
        return NextResponse.json({ ok: false, error: err?.message ?? "send failed" }, { status: 500 });
    }
}
