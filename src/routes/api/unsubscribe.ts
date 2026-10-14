import { createFileRoute } from "@tanstack/react-router";

/**
 * One-click unsubscribe (RFC 8058) and the /unsubscribe page's button both
 * POST here. GET never deletes; see src/lib/launch/unsubscribe-handler.ts.
 */
async function handle(request: Request): Promise<Response> {
  const { handleUnsubscribeRequest } = await import("@/lib/launch/unsubscribe-handler");
  const { unsubscribeByToken } = await import("@/lib/launch/unsubscribe.server");
  const { reportServerError } = await import("@/lib/server/alert");
  return handleUnsubscribeRequest(request, {
    unsubscribe: (token) => unsubscribeByToken(token),
    onError: (error) => reportServerError({ scope: "unsubscribe", error }),
  });
}

export const Route = createFileRoute("/api/unsubscribe")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
