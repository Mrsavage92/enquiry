import { getRequest } from "@tanstack/react-start/server";
import { rateLimit } from "./guard";

export type LaunchGate = "waitlist" | "qualify" | "event" | "roadmap" | "needs";

const LIMITS: Record<LaunchGate, readonly [number, number]> = {
  waitlist: [8, 60 * 60 * 1000],
  qualify: [12, 60 * 60 * 1000],
  event: [40, 60 * 1000],
  roadmap: [30, 60 * 1000],
  needs: [30, 60 * 1000],
};

function clientIp() {
  try {
    const req = getRequest();
    if (!req) return "unknown";
    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const real = req.headers.get("x-real-ip")?.trim();
    return (forwarded || real || "unknown").slice(0, 80);
  } catch {
    return "unknown";
  }
}

function assertNotCrossSite() {
  try {
    const req = getRequest();
    if (!req) return;
    const site = req.headers.get("sec-fetch-site");
    if (site === "cross-site") throw new Error("Rejected.");
    const origin = req.headers.get("origin");
    if (!origin) return;
    const url = new URL(req.url);
    if (origin !== url.origin) throw new Error("Rejected.");
  } catch (err) {
    if (err instanceof Error && err.message === "Rejected.") throw err;
  }
}

/** Returns "drop" for noisy endpoints that should fail closed without an error. */
export function protectLaunch(kind: LaunchGate): "ok" | "drop" {
  assertNotCrossSite();
  const [limit, windowMs] = LIMITS[kind];
  if (!rateLimit(`${kind}:${clientIp()}`, limit, windowMs)) {
    if (kind === "event" || kind === "needs") return "drop";
    throw new Error("Try again in a moment.");
  }
  return "ok";
}
