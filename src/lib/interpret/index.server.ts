import type { EnquiryInterpreter } from "./types";
import { nullInterpreter } from "./null-interpreter";
import { isStubInterpreterEnabled, stubInterpreter } from "./stub-interpreter";
import { createAnthropicInterpreter } from "./anthropic-interpreter.server";

/**
 * Choose the interpreter, server-only.
 *
 * Order matters: the dev-only stub (explicit opt-in, never production) first,
 * then a real provider when a key is configured, then the null fallback -
 * which is also what a genuinely unconfigured production deployment gets, on
 * purpose. Nothing here throws; an enquiry is never created faster or slower,
 * or lost, because of what this function returns.
 */
export function createInterpreter(): EnquiryInterpreter {
  if (isStubInterpreterEnabled()) return stubInterpreter;

  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  if (apiKey.trim()) {
    return createAnthropicInterpreter({
      apiKey,
      model: process.env.ENQUIRY_INTERPRETER_MODEL,
    });
  }

  return nullInterpreter;
}
