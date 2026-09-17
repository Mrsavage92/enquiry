/**
 * Outbound product email.
 *
 * One transport (Resend's HTTP API over plain fetch, no SDK and no new
 * dependency). It is deliberately inert until BOTH `RESEND_API_KEY` and
 * `EMAIL_FROM` are set in the environment, so this ships and deploys safely
 * before the mailbox exists: it logs `[email] skipped` and returns, rather
 * than throwing or half-sending from a fake sender.
 *
 * Rules, matching lib/server/alert.ts:
 * - never throws, so a mail outage can never fail a user's signup;
 * - never blocks a request longer than SEND_TIMEOUT_MS;
 * - logs every outcome so the Vercel stream is searchable.
 *
 * Auth email (the magic link) is NOT sent through here. Supabase sends that
 * from its own hosted template; see emails/README.md. Both should point at
 * the same verified sending domain once it exists.
 */

const SEND_TIMEOUT_MS = 5000;
const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Where a human reply lands. Defaults to the public support address. */
  replyTo?: string;
};

export type SendOutcome = "sent" | "skipped" | "failed";

export type SendOptions = {
  apiKey?: string;
  from?: string;
  fetchImpl?: typeof fetch;
};

function resolveConfig(options: SendOptions) {
  const apiKey = options.apiKey ?? process.env.RESEND_API_KEY ?? "";
  const from = options.from ?? process.env.EMAIL_FROM ?? "";
  return { apiKey, from };
}

/**
 * Sends one message. Returns "skipped" when the mailbox is not configured
 * yet, "failed" when the provider rejected or timed out, "sent" on a 2xx.
 */
export async function sendEmail(
  message: EmailMessage,
  options: SendOptions = {},
): Promise<SendOutcome> {
  const { apiKey, from } = resolveConfig(options);
  if (!apiKey || !from) {
    console.info(`[email] skipped "${message.subject}": mail sending is not configured`);
    return "skipped";
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const response = await fetchImpl(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error(`[email] failed "${message.subject}": provider returned ${response.status}`);
      return "failed";
    }
    console.info(`[email] sent "${message.subject}"`);
    return "sent";
  } catch {
    console.error(`[email] failed "${message.subject}": request threw or timed out`);
    return "failed";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fire-and-forget form for request handlers. A signup must succeed whether
 * or not the welcome email does, so nothing here is awaited by the caller.
 */
export function sendEmailInBackground(message: EmailMessage, options: SendOptions = {}): void {
  void sendEmail(message, options).catch(() => undefined);
}
