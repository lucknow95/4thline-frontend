// src/app/merch/confirmed/page.tsx
import Link from "next/link";

export const dynamic = "force-static";

export default async function MerchConfirmedPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const sp = await searchParams;

    const readOne = (v: string | string[] | undefined) =>
        Array.isArray(v) ? v[0] : v ?? null;

    const confirmed = readOne(sp.confirmed); // "1" | "true" | "success" (optional)
    const error = readOne(sp.error);

    const success =
        typeof confirmed === "string" &&
        new Set(["1", "true", "success"]).has(confirmed.toLowerCase());

    const title = success
        ? "🎉 Merch Updates Confirmed"
        : error
            ? "Confirmation Failed"
            : "Confirming…";

    return (
        <main className="px-6 py-10 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-4">{title}</h1>

            {success && (
                <p className="text-lg">
                    You’re on the list! You’ll be the first to hear about{" "}
                    <strong>4th Line Fantasy</strong> merch drops, exclusive offers, and early access deals.
                </p>
            )}

            {!success && !error && (
                <p className="text-lg">
                    Processing your confirmation link… If this page doesn’t update, please open the link from
                    your email again.
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
