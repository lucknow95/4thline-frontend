// src/app/newsletter/confirmed/page.tsx
import Link from 'next/link';

export const dynamic = 'force-static';

export default async function NewsletterConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const readOne = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v ?? null;

  const confirmed = readOne(sp.confirmed); // "1", "true", "success" (optional)
  const error = readOne(sp.error);         // "invalid" | "unknown" | other (optional)

  let title = 'Subscription Confirmed';
  let body =
    'Thanks for confirming your subscription to the 4th Line Fantasy newsletter! 🎉';
  let isError = false;

  if (error) {
    isError = true;
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
    // Direct visit without the param — show a friendly generic success/update message.
    title = 'Subscription Updated';
    body =
      'Your newsletter preferences have been updated. If you meant to confirm a new subscription, please use the confirmation link from your email.';
  }

  return (
    <main className="px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-3">{title}</h1>

      <div
        className={
          isError
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
