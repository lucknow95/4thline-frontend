"use client";
import Link from "next/link";

export default function MerchConfirmedPage() {
    return (
        <main className="px-6 py-10">
            <h1 className="text-3xl font-bold mb-4">🎉 Merch Updates Confirmed</h1>
            <p className="text-lg">
                Thanks for signing up! You’ll be the first to hear about{" "}
                <strong>4th Line Fantasy</strong> merch drops, exclusive offers, and
                early access deals.
            </p>
            <p className="mt-6 underline">
                <Link href="/merch">Back to Merch</Link>
            </p>
        </main>
    );
}
