import { rateLimit } from "./guard";
import { FROM_PAGE_FIELD, FROM_PAGE_VALUE } from "./unsubscribe-form";

/**
 * Mail providers send RFC 8058 one-click POSTs from shared IP pools, so one
 * address can carry many real people's unsubscribes. The token is the real
 * protection; this only stops a runaway loop.
 */
export const UNSUBSCRIBE_LIMIT = 300;
export const UNSUBSCRIBE_WINDOW_MS = 60 * 60 * 1000;


export type UnsubscribeResult = "removed" | "already-removed" | "invalid";

const MESSAGES: Record<UnsubscribeResult, string> = {
  removed: "You have been removed from the list. Your email and answers are deleted.",
  "already-removed": "This email is not on the list any more. Nothing else to do.",
  invalid: "This unsubscribe link is not valid. Reply to any email from us and we will remove you.",
};

export type UnsubscribeDeps = {
  unsubscribe: (token: string) => Promise<UnsubscribeResult>;
  onError?: (error: unknown) => void;
  now?: number;
};

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

async function cameFromPage(request: Request): Promise<boolean> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("application/x-www-form-urlencoded")) return false;
  try {
    const form = new URLSearchParams(await request.text());
    return form.get(FROM_PAGE_FIELD) === FROM_PAGE_VALUE;
  } catch {
    return false;
  }
}

/**
 * The /api/unsubscribe handler. Only POST deletes: a GET (a link scanner, a
 * prefetch) gets 405 and removes nobody. Cross-site POSTs are allowed on
 * purpose, because the mail provider is the one posting for a one-click
 * unsubscribe; the sealed token in `?t=` is the only proof needed.
 */
export async function handleUnsubscribeRequest(
  request: Request,
  deps: UnsubscribeDeps,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });
  }
  if (
    !rateLimit(
      `unsubscribe:${clientIp(request)}`,
      UNSUBSCRIBE_LIMIT,
      UNSUBSCRIBE_WINDOW_MS,
      deps.now,
    )
  ) {
    return new Response("Try again in a moment.", { status: 429 });
  }
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? "";
  const fromPage = await cameFromPage(request);
  let result: UnsubscribeResult;
  try {
    result = await deps.unsubscribe(token);
  } catch (error) {
    deps.onError?.(error);
    return new Response("Could not remove you just now. Please try again.", { status: 500 });
  }
  if (fromPage) {
    const back = new URL("/unsubscribe", url.origin);
    back.searchParams.set("result", result);
    return new Response(null, { status: 303, headers: { location: back.pathname + back.search } });
  }
  const status = result === "invalid" ? 400 : 200;
  if ((request.headers.get("accept") ?? "").includes("application/json")) {
    return Response.json({ outcome: result }, { status });
  }
  return new Response(MESSAGES[result], {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
