/**
 * Server-side error alerting for the early-access cohort.
 *
 * Before this file existed a production exception was only visible in the
 * Vercel log stream, which nobody watches. This sends one message per
 * failure to `ALERT_WEBHOOK_URL` (a Slack or Discord incoming webhook, or an
 * n8n webhook that emails the owner) and always writes a structured
 * `[alert]` line so the log stream stays searchable when no webhook is set.
 *
 * Rules: never throws, never blocks the request for longer than
 * ALERT_TIMEOUT_MS, never includes request bodies or customer content -
 * only the scope, the error message, the first stack line and small
 * scalar context the caller chose to attach.
 */

const ALERT_TIMEOUT_MS = 3000;
const MAX_MESSAGE = 600;
const MAX_STACK_LINES = 3;

export type AlertContext = Record<string, string | number | boolean | null | undefined>;

export type AlertInput = {
  scope: string;
  error: unknown;
  context?: AlertContext;
};

export type AlertOutcome = "sent" | "skipped" | "failed";

export type AlertOptions = {
  webhookUrl?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

export function describeError(error: unknown): { message: string; stack: string } {
  if (error instanceof Error) {
    const stack = (error.stack ?? "")
      .split("\n")
      .slice(1, 1 + MAX_STACK_LINES)
      .map((line) => line.trim())
      .join(" | ");
    return { message: error.message.slice(0, MAX_MESSAGE), stack };
  }
  if (typeof error === "string") return { message: error.slice(0, MAX_MESSAGE), stack: "" };
  try {
    return { message: JSON.stringify(error).slice(0, MAX_MESSAGE), stack: "" };
  } catch {
    return { message: String(error).slice(0, MAX_MESSAGE), stack: "" };
  }
}

export function formatAlert(input: AlertInput, at: Date): string {
  const { message, stack } = describeError(input.error);
  const context = Object.entries(input.context ?? {})
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  const lines = [`Enquiry error in ${input.scope} at ${at.toISOString()}`, message];
  if (stack) lines.push(stack);
  if (context) lines.push(context);
  return lines.join("\n");
}

/**
 * Sends the alert. Resolves "skipped" when no webhook is configured,
 * "failed" when the webhook rejected or timed out, "sent" on a 2xx.
 * The body carries both `text` (Slack) and `content` (Discord) so either
 * webhook shape works without configuration.
 */
export async function sendAlert(
  input: AlertInput,
  options: AlertOptions = {},
): Promise<AlertOutcome> {
  const at = (options.now ?? (() => new Date()))();
  const text = formatAlert(input, at);
  console.error(`[alert] ${text.replace(/\n/g, " || ")}`);
  const url = options.webhookUrl ?? process.env.ALERT_WEBHOOK_URL ?? "";
  if (!url) return "skipped";
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ALERT_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, content: text }),
      signal: controller.signal,
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  } finally {
    clearTimeout(timer);
  }
}

/** Fire-and-forget form for request handlers. Never throws, never awaited. */
export function reportServerError(input: AlertInput): void {
  void sendAlert(input).catch(() => undefined);
}

/**
 * Wraps a server-function handler so an unexpected throw is reported before
 * it propagates. `isExpected` opts specific errors out (validation and
 * rate-limit rejections are user outcomes, not incidents).
 */
export function guarded<Args extends unknown[], Result>(
  scope: string,
  fn: (...args: Args) => Promise<Result>,
  isExpected: (error: unknown) => boolean = () => false,
): (...args: Args) => Promise<Result> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (!isExpected(error)) reportServerError({ scope, error });
      throw error;
    }
  };
}
