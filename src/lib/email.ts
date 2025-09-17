// src/lib/email.ts
import { Resend } from "resend";

/**
 * Absolute base URL used to build links in emails.
 * Prefer NEXT_PUBLIC_BASE_URL in prod (e.g., https://4thlinefantasy.com),
 * fallback to APP_BASE_URL, then local dev.
 */
const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.APP_BASE_URL ||
  "http://localhost:3000";

/**
 * Resend client & From address
 */
const resend = new Resend(process.env.RESEND_API_KEY!);
const EMAIL_FROM = process.env.EMAIL_FROM!;
if (!EMAIL_FROM) {
  throw new Error("EMAIL_FROM env var is required");
}

export type ListType = "newsletter" | "merch";

/**
 * Helpers to build confirm/unsubscribe links that hit API routes,
 * which do DB work and then redirect to pretty pages.
 */
export function confirmLink(token: string, list: ListType) {
  // Confirm route fixed to /api/confirm-subscription
  return `${BASE_URL}/api/confirm-subscription?token=${encodeURIComponent(
    token
  )}&list=${encodeURIComponent(list)}`;
}

export function unsubscribeLink(token: string, list: ListType) {
  return `${BASE_URL}/api/unsubscribe?token=${encodeURIComponent(
    token
  )}&list=${encodeURIComponent(list)}`;
}

/**
 * Type used by resend.emails.send so we stay aligned with the SDK.
 */
type SendArgs = Parameters<Resend["emails"]["send"]>[0];

/**
 * Public input to our helpers (plain and simple).
 * We will OMIT any key that is undefined before calling Resend.
 */
export type BuildEmailInput = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  smtpHeaders?: Record<string, string>; // some inboxes/ESPs expect these
  // If you later add JSX templates with @react-email:
  // react?: React.ReactElement;
};

/** Utility: strip undefined values (avoids html: undefined, etc.) */
function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as Partial<T>;
}

/** Build exact payload for Resend with undefined keys removed */
export function buildEmailOptions(input: BuildEmailInput): SendArgs {
  const base = {
    from: EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    headers: input.headers,
    smtpHeaders: input.smtpHeaders, // send in both places for widest compatibility
    // react: input.react,
  };
  return omitUndefined(base) as SendArgs;
}

/**
 * Generic sender with helpful logging.
 * Ensures at least one of html | text is provided.
 */
export async function sendEmail(input: BuildEmailInput) {
  const options = buildEmailOptions(input);

  const hasHtml = "html" in options && typeof (options as any).html === "string";
  const hasText = "text" in options && typeof (options as any).text === "string";
  // const hasReact = "react" in options && !!(options as any).react;

  if (!hasHtml && !hasText /* && !hasReact */) {
    throw new Error("Email must include at least one of: html, text.");
  }

  const result = await resend.emails.send(options);

  // Log success/failure to aid setup & debugging
  const id = (result as any)?.data?.id ?? null;
  const err = (result as any)?.error ?? null;

  if (err) {
    console.error("[resend] send FAILED:", {
      to: (options as any).to,
      subject: (options as any).subject,
      error: err,
    });
    throw new Error(`Resend error: ${err?.message ?? "unknown error"}`);
  }

  console.log("[resend] send OK:", {
    id,
    to: (options as any).to,
    subject: (options as any).subject,
  });

  return result;
}

/**
 * Confirmation email for subscribe flows
 */
export async function sendConfirmEmail(
  to: string,
  confirmUrl: string,
  list: ListType = "newsletter"
) {
  const subject = `Confirm your ${list} subscription`;

  const text = [
    `Thanks for signing up for the 4th Line Fantasy ${list}.`,
    `Confirm your subscription by opening this link:`,
    confirmUrl,
    ``,
    `If you didn't request this, you can ignore this email.`,
  ].join("\n");

  const html = `
    <div style="font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; line-height:1.6;">
      <p>Thanks for signing up for the <strong>4th Line Fantasy</strong> ${list}.</p>
      <p>Click the button below to confirm your subscription.</p>
      <p>
        <a href="${confirmUrl}" style="
          display:inline-block;
          padding:12px 18px;
          text-decoration:none;
          border-radius:8px;
          background:#0f172a;
          color:#ffffff;
          font-weight:600;
        ">Confirm Subscription</a>
      </p>
      <p>If the button doesn't work, copy and paste this URL into your browser:</p>
      <p><a href="${confirmUrl}">${confirmUrl}</a></p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
      <p style="color:#6b7280;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;

  return await sendEmail({ to, subject, html, text });
}

/**
 * List-sending helper that adds RFC-compliant unsubscribe headers.
 * Use this for broadcast/list emails (not the initial confirmation).
 *
 * For One-Click, the unsubscribe URL should accept POSTs at /api/unsubscribe.
 */
export async function sendListEmail(
  input: BuildEmailInput & {
    list: ListType;
    unsubscribeUrl?: string;     // e.g., /api/unsubscribe?list=newsletter (you can add &token=... later)
    unsubscribeMailto?: string;  // e.g., mailto:unsubscribe@4thlinefantasy.com?subject=unsubscribe
  }
) {
  const {
    list,
    unsubscribeUrl: providedUrl,
    unsubscribeMailto: providedMailto,
    headers = {},
    smtpHeaders = {},
    ...rest
  } = input;

  // Sensible defaults if caller didn’t pass explicit values
  const defaultApiUrl = `${BASE_URL}/api/unsubscribe?list=${encodeURIComponent(list)}`;
  const defaultMailto = `mailto:unsubscribe@4thlinefantasy.com?subject=unsubscribe`;

  const unsubscribeUrl = providedUrl || defaultApiUrl;
  const unsubscribeMailto = providedMailto || defaultMailto;

  // RFC headers many inboxes key off of
  const listVals: Record<string, string> = {
    "List-Id": `${list}.4thlinefantasy.com`,
    "X-List": list,
  };

  const parts: string[] = [];
  if (unsubscribeMailto) parts.push(`<${unsubscribeMailto}>`);
  if (unsubscribeUrl) parts.push(`<${unsubscribeUrl}>`);
  if (parts.length) {
    listVals["List-Unsubscribe"] = parts.join(", ");
    listVals["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  return await sendEmail({
    ...rest,
    headers: { ...headers, ...listVals },
    smtpHeaders: { ...smtpHeaders, ...listVals }, // send in both places
  });
}
