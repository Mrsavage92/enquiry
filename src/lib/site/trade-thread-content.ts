import { GENERATED_THREADS } from "./trade-threads.data";
import { TRADE_INPUTS, type TradeThread } from "./trade-threads";

/** Each example's inputs joined to what the engine made of them. */
export const TRADE_THREADS: readonly TradeThread[] = TRADE_INPUTS.map((input) => {
  const out = GENERATED_THREADS.find((t) => t.id === input.id);
  if (!out) throw new Error(`No engine output for the ${input.id} example.`);
  return { ...input, ...out };
});
