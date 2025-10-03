// src/app/merch/confirmed/page.tsx
import Link from "next/link";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | null {
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

function isTrueish(s: string | null): boolean {
    return typeof s === "string" && new Set(["1", "true", "success"]).has(s.toLowerCase());
}

export default async function MerchConfirmedPage({
    searchParams,
}: {
    searchParams: Promise<SP>; // ✅ Next 15 expects a Promise
}) {
    const sp = await searchParams; // ✅ await it

    const confirmed = one(sp.confirmed);
    const unsub = one(sp.unsub);
    const error = one(sp.error);

    const didConfirm = isTrueish(confirmed);
    const didUnsub = isTrueish(unsub);

    let title = "Confirming…";
    if (didConfirm) title = "🎉 Merch Updates Confirmed";
    if (didUnsub) title = "You’ve Unsubscribed from Merch Updates";
    if (error) title = "Confirmation Failed";

    return (
        <main className="px-6 py-10 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-4">{title}</h1>

            {didConfirm && (
                <p className="text-lg">
                    You’re on the list! You’ll be the first to hear about{" "}
                    <strong>4th Line Fantasy</strong> merch drops, exclusive offers, and early access deals.
                </p>
            )}

            {didUnsub && (
                <p className="text-lg">
                    You’ve been unsubscribed from <strong>Merch</strong> updates. You can re-subscribe any time on the{" "}
                    <Link href="/merch" className="underline">Merch page</Link>.
                </p>
            )}

            {!didConfirm && !didUnsub && !error && (
                <p className="text-lg">
                    Processing your confirmation link… If this page doesn’t update, please open the link from your email again.
                </p>
            )}

            {error && (
                <p className="text-lg text-red-600">
                    We couldn’t confirm your merch subscription: <span className="font-mono">{error}</span>
                </p>
            )}

            <p className="mt-6 underline">
                <Link href="/merch">Back to Merch</Link>
            </p>
        </main>
    );
}
