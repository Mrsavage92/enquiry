import { createFileRoute } from "@tanstack/react-router";

const UNSUBSCRIBE_LIMIT = 30;
const UNSUBSCRIBE_WINDOW_MS = 60 * 60 * 1000;

const MESSAGES = {
  removed: "You have been removed from the list. Your email and answers are deleted.",
  "already-removed": "This email is not on the list any more. Nothing else to do.",
  invalid: "This unsubscribe link is not valid. Reply to any email from us and we will remove you.",
} as const;

/**
 * One-click unsubscribe (RFC 8058). Mail clients POST here when someone
 * presses their built-in unsubscribe button; the /unsubscribe page POSTs here
 * when the link in the email body is opened. GET never deletes, so a link
 * scanner that fetches every URL in an email cannot remove anyone.
 *
 * The sealed token in `?t=` is the only proof needed: no sign-in, no email
 * address. Cross-site requests are allowed on purpose, because the mail
 * provider is the one posting.
 */
export const Route = createFileRoute("/api/unsubscribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { rateLimit } = await import("@/lib/launch/guard");
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        if (!rateLimit(`unsubscribe:${ip}`, UNSUBSCRIBE_LIMIT, UNSUBSCRIBE_WINDOW_MS)) {
          return new Response("Try again in a moment.", { status: 429 });
        }
        const token = new URL(request.url).searchParams.get("t") ?? "";
        const { unsubscribeByToken } = await import("@/lib/launch/unsubscribe.server");
        const { reportServerError } = await import("@/lib/server/alert");
        try {
          const outcome = await unsubscribeByToken(token);
          const status = outcome === "invalid" ? 400 : 200;
          if ((request.headers.get("accept") ?? "").includes("application/json")) {
            return Response.json({ outcome }, { status });
          }
          return new Response(MESSAGES[outcome], {
            status,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        } catch (error) {
          reportServerError({ scope: "unsubscribe", error });
          return new Response("Could not remove you just now. Please try again.", { status: 500 });
        }
      },
    },
  },
});
