/**
 * Examples in the owner's own trade.
 *
 * A painter adding their first enquiry was shown "Need makeup for me and 3
 * bridesmaids" and a price form pre-set to "per person / guests". Every example
 * is a hint about what Enquiry expects, so a beauty example tells a painter the
 * product is not for them. These are read from what the owner said they do at
 * onboarding (free text), and only ever used as placeholders and starting
 * values the owner can change; nothing is saved from them.
 */

export type Trade = "painting" | "cleaning" | "beauty" | "general";

export type TradeExamples = {
  trade: Trade;
  /** Placeholder for "What the customer said". */
  message: string;
  customerName: string;
  customerEmail: string;
  service: string;
  intakeNote: string;
  /** The price form's starting shape. */
  price: { service: string; amount: string; unit: string; field: string; minimum: string };
  /** One price written as a sentence, for the sentence box. */
  sentence: string;
  flatSentence: string;
};

const EXAMPLES: Record<Trade, TradeExamples> = {
  painting: {
    trade: "painting",
    message:
      "Hi, we'd like three bedrooms and the hallway repainted, roughly 90 square metres. Could you do Sat 17 Oct?",
    customerName: "Karen",
    customerEmail: "karen@example.com",
    service: "Interior painting",
    intakeNote: "She emailed, I pasted it in",
    price: {
      service: "Interior painting",
      amount: "30",
      unit: "square metre",
      field: "square metres",
      minimum: "",
    },
    sentence: "Interior painting $30 per square metre",
    flatSentence: "Exterior repaint $5,500",
  },
  cleaning: {
    trade: "cleaning",
    message: "Hi, need an end of lease clean for a 2 bedroom unit on the 30th. How much?",
    customerName: "Priya",
    customerEmail: "priya@example.com",
    service: "End of lease clean",
    intakeNote: "She texted, I typed it up",
    price: {
      service: "End of lease clean",
      amount: "190",
      unit: "bedroom",
      field: "bedrooms",
      minimum: "",
    },
    sentence: "End of lease clean $190 per bedroom",
    flatSentence: "Oven clean $120",
  },
  beauty: {
    trade: "beauty",
    message: "Hi! Need makeup for 4 people, me and 3 bridesmaids, on the 14th. What do you charge?",
    customerName: "Sarah",
    customerEmail: "sarah@example.com",
    service: "Group makeup",
    intakeNote: "She rang, I typed it up",
    price: {
      service: "Group makeup",
      amount: "145",
      unit: "person",
      field: "people",
      minimum: "3",
    },
    sentence: "Group makeup $145 per person",
    flatSentence: "Bridal trial $120",
  },
  general: {
    trade: "general",
    message: "Hi, could you quote for about 3 hours of work next Saturday?",
    customerName: "Sam",
    customerEmail: "sam@example.com",
    service: "Standard job",
    intakeNote: "They rang, I typed it up",
    price: { service: "Standard job", amount: "90", unit: "hour", field: "hours", minimum: "" },
    sentence: "Standard job $90 per hour",
    flatSentence: "Call-out $80",
  },
};

const PATTERNS: [RegExp, Trade][] = [
  [/paint|decorat|render|plaster/i, "painting"],
  [/clean|carpet|window wash|pressure wash|housekeep/i, "cleaning"],
  [/make.?up|hair|beauty|nail|lash|brow|bridal|salon|spray tan|mua/i, "beauty"],
];

export function tradeOf(industry: string | null | undefined): Trade {
  const text = (industry ?? "").trim();
  for (const [re, trade] of PATTERNS) if (re.test(text)) return trade;
  return "general";
}

export function tradeExamples(industry: string | null | undefined): TradeExamples {
  return EXAMPLES[tradeOf(industry)];
}
