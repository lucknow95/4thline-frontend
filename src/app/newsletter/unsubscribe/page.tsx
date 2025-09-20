'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useTransition } from 'react';

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function NewsletterUnsubscribePage() {
    // Wrap any useSearchParams usage in a Suspense boundary
    return (
        <Suspense
            fallback={
                <main className="px-4 py-8 max-w-2xl mx-auto">
                    <h1 className="text-2xl font-bold mb-3">Unsubscribe – Newsletter</h1>
                    <p className="mb-6">Loading…</p>
                </main>
            }
        >
            <UnsubscribeContent />
        </Suspense>
    );
}

function UnsubscribeContent() {
    const sp = useSearchParams();
    const status = sp.get('status'); // "success" | "invalid" | "error" (optional)

    const [email, setEmail] = useState('');
    const [formMsg, setFormMsg] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    let title = 'Unsubscribe – Newsletter';
    let message = 'Confirm you want to unsubscribe from the 4th Line Fantasy newsletter.';

    if (status === 'success') {
        title = 'Unsubscribed';
        message =
            'You’ve been unsubscribed from the 4th Line Fantasy newsletter. You can re-subscribe anytime.';
    } else if (status === 'invalid') {
        title = 'Invalid Link';
        message =
            'This unsubscribe link is invalid or has already been used. If you still receive emails, please try again from a newer email.';
    } else if (status === 'error') {
        title = 'Something Went Wrong';
        message = 'We couldn’t process your unsubscribe request. Please try again later.';
    }

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormMsg(null);

        if (!emailRe.test(email)) {
            setFormMsg('Please enter a valid email address.');
            return;
        }

        startTransition(async () => {
            try {
                const res = await fetch('/api/unsubscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ list: 'newsletter', email }),
                });

                if (res.ok) {
                    setFormMsg('Success! You are unsubscribed from the newsletter.');
                } else {
                    const j = await res.json().catch(() => ({}));
                    setFormMsg(
                        j?.error ? `Error: ${j.error}` : 'Error: Unable to unsubscribe. Please try again.'
                    );
                }
            } catch {
                setFormMsg('Network error: please try again.');
            }
        });
    };

    const showManualForm = !status || status === 'invalid' || status === 'error';

    return (
        <main className="px-4 py-8 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-3">{title}</h1>
            <p className="mb-6">{message}</p>

            {showManualForm && (
                <section className="mb-8 rounded-2xl border border-neutral-700/40 p-4">
                    <h2 className="font-semibold mb-2">Unsubscribe manually</h2>
                    <p className="text-sm text-neutral-400 mb-4">
                        If you arrived here without a link from an email, you can unsubscribe by entering your
                        email below.
                    </p>

                    <form onSubmit={onSubmit} className="flex flex-col gap-3">
                        <label htmlFor="email" className="text-sm font-medium">
                            Email address
                        </label>
                        <input
                            id="email"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="rounded-xl border border-neutral-700/50 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500"
                            placeholder="you@example.com"
                        />
                        <button
                            type="submit"
                            disabled={isPending}
                            className="inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium border border-neutral-700/50 hover:border-orange-500 hover:text-orange-500 transition-colors disabled:opacity-60"
                        >
                            {isPending ? 'Unsubscribing…' : 'Unsubscribe from Newsletter'}
                        </button>

                        {formMsg && <p className="text-sm mt-1">{formMsg}</p>}
                    </form>

                    <p className="text-xs text-neutral-500 mt-4">
                        Prefer email? Send a message to{' '}
                        <a href="mailto:unsubscribe@4thlinefantasy.com?subject=unsubscribe" className="underline">
                            unsubscribe@4thlinefantasy.com
                        </a>
                        .
                    </p>
                </section>
            )}

            <div className="mt-6 flex flex-wrap gap-4">
                <Link href="/" className="underline">
                    Home
                </Link>
                <Link href="/newsletter" className="underline">
                    Newsletter
                </Link>
                <Link href="/rankings" className="underline">
                    Player Rankings
                </Link>
            </div>
        </main>
    );
}
