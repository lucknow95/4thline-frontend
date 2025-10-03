// src/lib/email.ts
import { Resend } from "resend";

/* ============================================================================
   4th Line Fantasy – Email Brand Tokens
   ========================================================================== */
const BRAND = {
  name: "4th Line Fantasy",
  // Primary brand blue + orange accent (good contrast on white & dark text)
  primary: "#1f6feb", // blue (was requested earlier)
  accent: "#fb923c",  // orange accent
  text: "#0b1220",    // near-black
  muted: "#6b7280",   // gray-500
  border: "#e5e7eb",  // gray-200
  bg: "#ffffff",      // white card bg
  page: "#f8fafc",    // very light page background
  radius: "10px",
};

/* ============================================================================
   Absolute Base URL
   Priority: NEXT_PUBLIC_BASE_URL -> APP_BASE_URL -> VERCEL_URL -> localhost
   ========================================================================== */
const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.APP_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
  "http://localhost:3000";

/** Build absolute URL from a path or return the input if already absolute. */
const absoluteUrl = (path: string) => (path.startsWith("/") ? `${BASE_URL}${path}` : path);

/* ============================================================================
   Resend client & From address
   ========================================================================== */
const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY env var is required");
const resend = new Resend(RESEND_API_KEY);

const EMAIL_FROM = process.env.EMAIL_FROM;
if (!EMAIL_FROM) throw new Error("EMAIL_FROM env var is required");

/* ============================================================================
   Public Types / Links
   ========================================================================== */
export type ListType = "newsletter" | "merch";

/** Confirm hits API then redirects to your pretty page */
export function confirmLink(token: string, list: ListType) {
  return `${BASE_URL}/api/confirm-subscription?token=${encodeURIComponent(token)}&list=${encodeURIComponent(list)}`;
}

/** Unsubscribe hits API which then redirects to your pretty page */
export function unsubscribeLink(token: string, list: ListType) {
  return `${BASE_URL}/api/unsubscribe?token=${encodeURIComponent(token)}&list=${encodeURIComponent(list)}`;
}

/* ============================================================================
   Resend payload helpers
   ========================================================================== */
type SendArgs = Parameters<Resend["emails"]["send"]>[0];

export type BuildEmailInput = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  smtpHeaders?: Record<string, string>;
  // react?: React.ReactElement; // future-proof if you adopt react-email
};

function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as Partial<T>;
}

export function buildEmailOptions(input: BuildEmailInput): SendArgs {
  const base = {
    from: EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    headers: input.headers,
    smtpHeaders: input.smtpHeaders,
  };
  return omitUndefined(base) as SendArgs;
}

/* ============================================================================
   Brand wrapper
   - If content already is a full HTML doc (has <html or <body>), we do NOT wrap.
   ========================================================================== */
function maybeWrapBrand(html: string, opts?: { heading?: string; footerHTML?: string }) {
  const lower = html.toLowerCase();
  const alreadyFullDoc = lower.includes("<html") || lower.includes("<body");
  if (alreadyFullDoc) return html;

  const heading = opts?.heading ?? BRAND.name;
  const footer = opts?.footerHTML ?? "";

  return `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${escapeHtml(heading)}</title>
    </head>
    <body style="margin:0;padding:0;background:${BRAND.page};">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BRAND.page};padding:24px 0;">
        <tr>
          <td>
            <table role="presentation" cellpadding="0" cellspacing="0" width="600" align="center" style="margin:0 auto;background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:${BRAND.radius};overflow:hidden;">
              <tr>
                <td style="padding:20px 24px;border-bottom:1px solid ${BRAND.border};">
                  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${BRAND.text};font-size:18px;font-weight:700;letter-spacing:0.2px;">
                    ${escapeHtml(heading)}
                  </div>
                  <div style="margin-top:6px;height:3px;width:56px;background:${BRAND.accent};border-radius:3px;"></div>
                </td>
              </tr>

              <tr>
                <td style="padding:24px;">
                  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${BRAND.text};font-size:16px;line-height:1.6;">
                    ${html}
                  </div>
                </td>
              </tr>

              ${footer
      ? `<tr>
                      <td style="padding:0 24px 20px 24px;">
                        <hr style="border:none;border-top:1px solid ${BRAND.border};margin:0 0 12px 0;" />
                        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${BRAND.muted};font-size:12px;line-height:1.5;">
                          ${footer}
                        </div>
                      </td>
                    </tr>`
      : ""
    }
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

/** Simple HTML escape for headings etc. */
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
}

/** Shared button style */
function brandButton(href: string, label: string) {
  return `
    <a href="${href}" style="
      display:inline-block;
      padding:12px 18px;
      text-decoration:none;
      border-radius:10px;
      background:${BRAND.primary};
      color:#ffffff;
      font-weight:700;
      letter-spacing:0.2px;
    ">${escapeHtml(label)}</a>
  `;
}

/* ============================================================================
   Core sender (logs + guards)
   ========================================================================== */
export async function sendEmail(input: BuildEmailInput) {
  const options = buildEmailOptions(input);

  const hasHtml = "html" in options && typeof (options as any).html === "string";
  const hasText = "text" in options && typeof (options as any).text === "string";
  if (!hasHtml && !hasText) throw new Error("Email must include at least one of: html, text.");

  const result = await resend.emails.send(options);
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

/* ============================================================================
   Confirmation email (subscribe flow)
   ========================================================================== */
export async function sendConfirmEmail({
  to,
  confirmUrl,
  list = "newsletter",
}: {
  to: string;
  confirmUrl: string;
  list?: ListType;
}) {
  const subject = `Confirm your ${list} subscription`;

  const text = [
    `Thanks for signing up for the ${BRAND.name} ${list}.`,
    `Confirm your subscription by opening this link:`,
    confirmUrl,
    ``,
    `If you didn't request this, you can ignore this email.`,
  ].join("\n");

  const inner = `
    <p>Thanks for signing up for the <strong>${BRAND.name}</strong> ${list}.</p>
    <p>Click the button below to confirm your subscription:</p>
    <p>${brandButton(confirmUrl, "Confirm Subscription")}</p>
    <p style="margin-top:16px;">If the button doesn't work, copy and paste this URL into your browser:</p>
    <p><a href="${confirmUrl}" style="color:${BRAND.primary};text-decoration:underline;">${confirmUrl}</a></p>
  `;

  const html = maybeWrapBrand(inner, {
    heading: `${BRAND.name}`,
    footerHTML: `If you didn't request this, you can safely ignore this email.`,
  });

  return await sendEmail({ to, subject, html, text });
}

/* ============================================================================
   List/Broadcast email (adds RFC-compliant unsubscribe headers)
   - Visible unsubscribe footer mirrors the headers.
   - If 'to' is a single address, the default unsubscribe URL includes &email=...
   ========================================================================== */
export async function sendListEmail(
  input: BuildEmailInput & {
    list: ListType;
    unsubscribeUrl?: string;     // e.g., /api/unsubscribe?list=newsletter[&token=...]
    unsubscribeMailto?: string;  // e.g., mailto:unsubscribe@4thlinefantasy.com?subject=unsubscribe
  }
) {
  const {
    list,
    unsubscribeUrl: providedUrl,
    unsubscribeMailto: providedMailto,
    headers = {},
    smtpHeaders = {},
    html: rawHtml,
    text,
    subject,
    to,
  } = input;

  // If 'to' is a single recipient, include &email=... in the default API url.
  const toAddr =
    typeof to === "string"
      ? to
      : Array.isArray(to) && to.length === 1
        ? String(to[0])
        : null;

  const defaultApiUrlBase = `${BASE_URL}/api/unsubscribe?list=${encodeURIComponent(list)}`;
  const defaultApiUrl = toAddr
    ? `${defaultApiUrlBase}&email=${encodeURIComponent(toAddr)}`
    : defaultApiUrlBase;
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

  // Visible unsubscribe footer
  const footerHTML = `
    You can unsubscribe anytime:
    <a href="${absoluteUrl(unsubscribeUrl)}" style="color:${BRAND.primary};text-decoration:underline;">unsubscribe</a>
    or email
    <a href="${unsubscribeMailto}" style="color:${BRAND.primary};text-decoration:underline;">unsubscribe@4thlinefantasy.com</a>.
  `;

  // Wrap caller-provided HTML with brand shell (unless it’s already a full doc)
  const htmlWrapped = rawHtml
    ? maybeWrapBrand(rawHtml, { heading: BRAND.name, footerHTML })
    : maybeWrapBrand(`<p>Hello from <strong>${BRAND.name}</strong>.</p>`, { heading: BRAND.name, footerHTML });

  // Build payload carefully (respect exactOptionalPropertyTypes)
  const payload: BuildEmailInput = {
    to,
    subject,
    html: htmlWrapped,
    headers: { ...headers, ...listVals },
    smtpHeaders: { ...smtpHeaders, ...listVals },
  };
  if (typeof text === "string") {
    payload.text = text;
  }

  return await sendEmail(payload);
}
