import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
        return NextResponse.redirect(new URL("/newsletter?verify=missing", url), { status: 307 });
    }

    // Forward to the canonical confirm route (single source of truth)
    const dest = new URL("/api/confirm-subscription", url);
    dest.searchParams.set("token", token);
    return NextResponse.redirect(dest, { status: 307 });
}
