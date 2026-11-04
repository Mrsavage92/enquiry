import { createFileRoute } from "@tanstack/react-router";

/**
 * A business's own website form posts enquiries here. Public, keyed by the
 * business's inbound key; see src/lib/repo/inbound-form-core.ts.
 */
type Limiter = (ip: string) => boolean;
const globalRef = globalThis as typeof globalThis & { __inboundIpLimiter__?: Limiter };

async function handle(request: Request): Promise<Response> {
  const { getSql, withTransaction } = await import("@/lib/db");
  const { handleInboundForm, createWindowLimiter } = await import("@/lib/repo/inbound-form-core");
  const { createInterpreter } = await import("@/lib/interpret/index.server");
  const { reportServerError } = await import("@/lib/server/alert");
  globalRef.__inboundIpLimiter__ ??= createWindowLimiter(30, 60_000);
  const allowIp = globalRef.__inboundIpLimiter__;
  try {
    return await handleInboundForm(request, {
      sql: await getSql(),
      runInTransaction: withTransaction,
      interpreter: createInterpreter(),
      allowIp: (ip) => allowIp(ip),
    });
  } catch (error) {
    reportServerError({ scope: "inboundForm", error });
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}

export const Route = createFileRoute("/api/inbound/form")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
      OPTIONS: ({ request }) => handle(request),
    },
  },
});
