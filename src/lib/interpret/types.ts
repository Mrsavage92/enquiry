import { z } from "zod";

/**
 * The interpretation adapter's contract (server-only).
 *
 * A model may READ a customer's message and PROPOSE facts. It never decides a
 * price, never decides eligibility, and never sends anything - the same
 * boundary `price-compiler.ts` already enforces by refusing to price off
 * anything but a `confirmed` fact. This file exists so every implementation
 * (a real provider, a dev-only stub, or "no provider configured") returns the
 * exact same shape, validated the same way, so nothing downstream has to trust
 * an adapter's own claim about what it returned.
 *
 * `.strict()` on every object schema is deliberate: a payload that tries to
 * smuggle an extra key (`action: "approve"`, `price: 1`) fails validation
 * rather than silently passing through as an ignored extra field.
 */

export const ConfidenceLevelSchema = z.enum(["low", "medium", "high"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const ServiceCandidateSchema = z
  .object({
    label: z.string().min(1).max(200),
    confidence: ConfidenceLevelSchema,
    span: z.string().min(1).max(400),
  })
  .strict();

export const CandidateFactSchema = z
  .object({
    field: z.string().min(1).max(120),
    value: z.string().min(1).max(400),
    displayValue: z.string().min(1).max(400),
    confidence: ConfidenceLevelSchema,
    span: z.string().min(1).max(400),
  })
  .strict();

export const InterpretationResultSchema = z
  .object({
    serviceCandidate: ServiceCandidateSchema.nullable(),
    facts: z.array(CandidateFactSchema).max(20),
    ambiguities: z.array(z.string().max(400)).max(20),
    candidateMissingFacts: z.array(z.string().max(120)).max(20),
  })
  .strict();

export type InterpretationResult = z.infer<typeof InterpretationResultSchema>;

/** Why an interpretation attempt did not produce a usable result. */
export type InterpretFailureReason =
  "no_provider" | "timeout" | "invalid_output" | "provider_error";

export type InterpretOutcome =
  | { ok: true; result: InterpretationResult; model: string }
  | { ok: false; reason: InterpretFailureReason };

/**
 * A business's own words, handed to the interpreter as context - never as
 * instructions the model should follow from the customer's message.
 */
export type InterpreterBusinessContext = {
  services: string[];
  ruleSummaries: string[];
  industry: string;
};

export type EnquiryInterpreter = {
  interpret(input: {
    rawMessage: string;
    messageId: string;
    business: InterpreterBusinessContext;
  }): Promise<InterpretOutcome>;
};
