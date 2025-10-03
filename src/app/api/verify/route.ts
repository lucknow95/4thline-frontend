// src/app/api/verify/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeInternalPath(path: string | null | undefined) {
    if (!path || typeof path !== "string") return null;
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("//")) return null;
    return path.startsWith("/") ? path : `/${path}`;
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const list = url.searchParams.get("list");        // optional legacy param
    const redirect = safeInternalPath(url.searchParams.get("redirect"));

    if (!token) {
        const fallback = new URL("/newsletter/confirmed?error=invalid", url);
        return NextResponse.redirect(fallback, { status: 302 });
    }

    const dest = new URL("/api/confirm-subscription", url);
    dest.searchParams.set("token", token);
    if (list) dest.searchParams.set("list", list);
    if (redirect) dest.searchParams.set("redirect", redirect);

    return NextResponse.redirect(dest, { status: 301 }); // permanent forward to canonical route
}
