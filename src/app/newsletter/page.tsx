// src/app/newsletter/page.tsx
import SubscribeForm from "@/components/SubscribeForm";
import Link from "next/link";

type VerifyKey =
  | "success"
  | "invalid"
  | "missing"
  | "error"
  // legacy values you used previously:
  | "1"
  | "expired"
  | "nosub"
  | undefined;

type UnsubKey = "success" | "invalid" | "missing" | "error" | undefined;

type Props = {
  // In App Router server components, searchParams can be awaited in your setup.
  searchParams: Promise<{
    // current keys used by routes we added:
    verify?: "success" | "invalid" | "missing" | "error";
    unsub?: UnsubKey;
    list?: string;
    // legacy key you already had on the page:
    verified?: VerifyKey;
  }>;
};

function Banner({
  kind,
  title,
  message,
}: {
  kind: "success" | "warning" | "error";
  title: string;
  message: string;
}) {
  const styles =
    kind === "success"
      ? "bg-green-50 border-green-200 text-green-800"
      : kind === "warning"
        ? "bg-amber-50 border-amber-200 text-amber-800"
        : "bg-rose-50 border-rose-200 text-rose-800";

  return (
    <div className={`mb-6 rounded-xl border p-4 ${styles}`}>
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-sm opacity-90">{message}</div>
    </div>
  );
}

function VerifiedBanner(value?: VerifyKey) {
  if (!value) return null;

  // Normalize newer values to your legacy ones:
  const v =
    value === "success"
      ? "1"
      : value === "invalid" || value === "missing" || value === "error"
        ? value
        : value; // "expired" | "nosub" | "1" remain as-is

  switch (v) {
    case "1":
      return (
        <Banner
          kind="success"
          title="You're subscribed!"
          message="Thanks for confirming your email. You’ll start receiving 4th Line Fantasy updates."
        />
      );
    case "invalid":
      return (
        <Banner
          kind="error"
          title="Invalid verification link"
          message="That link is not valid or has already been used. Please try subscribing again."
        />
      );
    case "expired":
      return (
        <Banner
          kind="warning"
          title="Verification link expired"
          message="Your confirmation link expired. Re-subscribe to receive a fresh link."
        />
      );
    case "nosub":
      return (
        <Banner
          kind="warning"
          title="Subscriber not found"
          message="We couldn't find that email/list. Try subscribing again."
        />
      );
    case "missing":
      return (
        <Banner
          kind="warning"
          title="No token provided"
          message="Your link was missing a token. Try the latest email we sent or re-subscribe."
        />
      );
    default:
      return (
        <Banner
          kind="error"
          title="Verification error"
          message="Something went wrong confirming your email. Please try again."
        />
      );
  }
}

function UnsubBanner(value?: UnsubKey) {
  if (!value) return null;

  switch (value) {
    case "success":
      return (
        <Banner
          kind="success"
          title="You're unsubscribed"
          message="You won’t receive further emails from this list. You can re-subscribe any time."
        />
      );
    case "invalid":
      return (
        <Banner
          kind="warning"
          title="Invalid unsubscribe link"
          message="That link didn’t match any active subscription. It may have already been used."
        />
      );
    case "missing":
      return (
        <Banner
          kind="warning"
          title="No token provided"
          message="Your unsubscribe link was missing a token."
        />
      );
    default:
      return (
        <Banner
          kind="error"
          title="Unsubscribe error"
          message="We couldn’t process your request. Please try again."
        />
      );
  }
}

export default async function Page({ searchParams }: Props) {
  // await searchParams for your current typing
  const params = await searchParams;

  // Accept both the new (`verify`) and legacy (`verified`) keys
  const verified: VerifyKey = (params.verify as VerifyKey) ?? params.verified;
  const unsub: UnsubKey = params.unsub;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      {/* Banners for verify/unsub outcomes */}
      {VerifiedBanner(verified)}
      {UnsubBanner(unsub)}

      {/* Newsletter header */}
      <h1 className="text-3xl font-bold tracking-tight">Newsletter</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Get weekly fantasy insights, schedule edges, and site updates. (Daily digests
        coming for paid users later.)
      </p>

      {/* Working client-driven subscribe form that posts JSON to /api/subscribe */}
      <div className="mt-6 rounded-xl border p-4">
        <SubscribeForm list="newsletter" />
        <p className="mt-2 text-xs text-neutral-500">
          By subscribing you consent to receive emails from 4th Line Fantasy. You can
          unsubscribe at any time.
        </p>
      </div>

      {/* Helpful links */}
      <div className="mt-8 text-sm text-neutral-600">
        <p>Accidentally unsubscribed? Re-enter your email above to re-subscribe.</p>
        <p className="mt-2">
          Head back to{" "}
          <Link href="/" className="underline underline-offset-4">
            Home
          </Link>{" "}
          or{" "}
          <Link href="/rankings" className="underline underline-offset-4">
            Player Rankings
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
