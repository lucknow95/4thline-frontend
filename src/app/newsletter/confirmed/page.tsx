'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function NewsletterConfirmedPage() {
  const sp = useSearchParams();
  const confirmed = sp.get('confirmed'); // "1" when success
  const error = sp.get('error');         // "invalid" | "unknown" (optional)

  let title = 'Subscription Confirmed';
  let body =
    'Thanks for confirming your subscription to the 4th Line Fantasy newsletter! 🎉';
  let variant: 'ok' | 'error' = 'ok';

  if (error) {
    variant = 'error';
    title = 'Confirmation Error';

    if (error === 'invalid') {
      body =
        'That confirmation link is invalid or may have already been used. If you still need access, try signing up again and use the newest email we send you.';
    } else if (error === 'unknown') {
      body =
        'Something went wrong while confirming your subscription. Please try the link again in a minute, or re-subscribe to receive a fresh confirmation email.';
    } else {
      body =
        'We couldn’t process your request. Please try again shortly, or re-subscribe to receive a new confirmation email.';
    }
  } else if (!confirmed) {
    // If someone visits this page directly without the param, show a friendly generic success.
    title = 'Subscription Updated';
    body =
      'Your newsletter preferences have been updated. If you meant to confirm a new subscription, please use the confirmation link from your email.';
  }

  return (
    <main className="px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-3">{title}</h1>

      <div
        className={
          variant === 'error'
            ? 'mb-6 rounded-2xl border border-red-700/40 bg-red-950/20 p-4'
            : 'mb-6 rounded-2xl border border-neutral-700/40 p-4'
        }
      >
        <p>{body}</p>
      </div>

      <div className="mt-6 flex flex-wrap gap-4">
        <Link href="/" className="underline">Home</Link>
        <Link href="/newsletter" className="underline">Newsletter</Link>
        <Link href="/rankings" className="underline">Player Rankings</Link>
      </div>
    </main>
  );
}
