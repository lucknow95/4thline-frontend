// src/app/merch/unsubscribe/page.tsx
import Link from "next/link";

// Keep this; fine for a static, querystring-only UI page
export const dynamic = "force-static";

// Next 15: searchParams is a Promise in PageProps.
// Make the page async and await it.
export default async function MerchUnsubscribePage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const sp = await searchParams;

    const readOne = (v: string | string[] | undefined) =>
        Array.isArray(v) ? v[0] : v ?? null;

    const unsubVal = readOne(sp.unsub);
    const errorMsg = readOne(sp.error);

    const successSet = new Set(["1", "true", "success"]);
    const success =
        typeof unsubVal === "string" && successSet.has(unsubVal.toLowerCase());

    return (
        <main className="px-4 py-8">
            <h1 className="text-2xl font-bold mb-4">Merch Unsubscribe</h1>

            {success && (
                <p>You’ve been unsubscribed from merch updates. Sorry to see you go!</p>
            )}

            {!success && !errorMsg && (
                <p>
                    We’re processing your unsubscribe request… If this page doesn’t
                    update, please try the link from your email again.
                </p>
            )}

            {errorMsg && (
                <p className="text-red-600">
                    Unsubscribe failed: <span className="font-mono">{errorMsg}</span>
                </p>
            )}

            <p className="mt-4">
                <Link href="/">Return to the homepage</Link>
            </p>
        </main>
    );
}
