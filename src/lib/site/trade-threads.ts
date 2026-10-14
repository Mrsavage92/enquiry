/**
 * "Built for your trade" on the home page: one example enquiry per trade, run
 * through the real engine.
 *
 * Only the inputs live here: the owner's saved price lines, what the customer
 * wrote, and what the owner types when they paste it in. Every verdict, check
 * and reply the page shows comes from `trade-threads.data.ts` (joined to these
 * inputs in `trade-thread-content.ts`), which
 * `trade-threads.db.test.ts` writes by driving these inputs through the same
 * path a pasted enquiry takes (insertManualEnquiry, decideEnquiry,
 * composeReply, promiseVerdict) against a real database. That test fails if
 * the shipped text drifts from what the engine produces today.
 *
 * These are examples with sample businesses and made-up customers. The page
 * labels them that way and must never present them as real customers.
 */

export type TradeId = "painter" | "cleaner" | "beauty";

export type TradeInput = {
  id: TradeId;
  /** The tab label. */
  tab: string;
  /** Onboarding's free-text trade, which picks the sample business's industry. */
  industry: string;
  ownerFirstName: string;
  /** The owner's own price lines, saved the way the business screen saves them. */
  ownerLines: readonly string[];
  customerName: string;
  /** What the customer sent, word for word. */
  message: string;
  /** "What are they asking for?" as the owner types it; empty when they leave it blank. */
  serviceLabel: string;
};

/** The day the examples were run: their dates are read relative to it. */
export const TRADE_THREADS_NOW = "2026-10-14T10:15:00+10:00";

export const TRADE_INPUTS: readonly TradeInput[] = [
  {
    id: "painter",
    tab: "Painter",
    industry: "painting",
    ownerFirstName: "Tom",
    ownerLines: ["Interior painting $30 per square metre"],
    customerName: "Karen",
    message:
      "Hi, we're after three bedrooms and the hallway repainted. Could you do Saturday 7 November? Cheers, Karen",
    serviceLabel: "Interior painting",
  },
  {
    id: "cleaner",
    tab: "Cleaner",
    industry: "cleaning",
    ownerFirstName: "Jess",
    ownerLines: ["End of lease clean $190 per bedroom"],
    customerName: "Priya",
    message:
      "Hi, need an end of lease clean for a 2 bedroom unit in Chermside on Friday 30 October. How much? Thanks, Priya",
    serviceLabel: "End of lease clean",
  },
  {
    id: "beauty",
    tab: "Mobile beauty",
    industry: "mobile makeup",
    ownerFirstName: "Mia",
    ownerLines: ["Bridal makeup $250", "Makeup trial $90", "We don't do spray tans"],
    customerName: "Chloe",
    message: "Hi, do you do spray tans? Saturday 21 November if you can. Chloe",
    serviceLabel: "",
  },
];

export type TradeThreadOutput = {
  id: TradeId;
  verdict: { word: "Yes" | "No" | "Not yet"; line: string };
  /** The one thing the decision rested on, in the app's own words to the owner. */
  checked: string;
  /** The next steps the app showed the owner before the reply was ready, in order. */
  ownerSteps: string[];
  /** The prepared reply, exactly as the app wrote it. */
  reply: string;
};

export type TradeThread = TradeInput & TradeThreadOutput;
