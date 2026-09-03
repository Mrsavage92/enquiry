import type { EnquiryInterpreter } from "./types";

/**
 * The fallback: no provider configured, so nothing is proposed.
 *
 * This IS the safety mechanism, not a placeholder for one. With no
 * `ANTHROPIC_API_KEY` set, `createInterpreter()` (`index.server.ts`) returns
 * this, and behaviour is byte-for-byte what it was before interpretation
 * existed - an operator-typed-only enquiry, no inferred facts, no surprises.
 */
export const nullInterpreter: EnquiryInterpreter = {
  async interpret() {
    return { ok: false, reason: "no_provider" };
  },
};
