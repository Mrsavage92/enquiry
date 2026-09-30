/**
 * Which trade a service belongs to, and which trades a message is about.
 *
 * A business can list services from more than one trade (a cleaner who also
 * paints ceilings). "Black mould on the bathroom ceiling, can u clean that"
 * names a ceiling, but it is a cleaning message: offering the painting
 * service "Ceilings" for it, or "Bridal makeup" for a painting job, tells the
 * owner nobody read it. A service of another trade is only offered when the
 * message is about that trade too.
 */

export type Trade = "painting" | "cleaning" | "beauty";

/** Words a service's name is known by, per trade. First match wins. */
const SERVICE_TRADES: [Trade, RegExp][] = [
  [
    "beauty",
    /\b(?:make-?up|bridal|bride|trial|lash(?:es)?|brows?|nails?|mani(?:cure)?|pedi(?:cure)?|gel|wax(?:ing)?|facials?|spray\s+tan|tan|hair|beauty)\b/i,
  ],
  [
    "painting",
    /\b(?:paint\w*|repaint\w*|ceilings?|walls?|render\w*|stain\w*|exterior|interior|coats?)\b/i,
  ],
  [
    "cleaning",
    /\b(?:clean\w*|carpets?|ovens?|lease|bond|vacate|steam|windows?|mould|rangehood|pressure\s+wash\w*|gutters?)\b/i,
  ],
];

/** Words that say what kind of work a message asks for: the work itself, not the thing. */
const MESSAGE_TRADES: [Trade, RegExp][] = [
  [
    "beauty",
    /\b(?:make-?up|bridal|bride|bridesmaids?|wedding|lash(?:es)?|brows?|nails?|mani(?:cure)?|pedi(?:cure)?|gel|wax(?:ing)?|facials?|spray\s+tan|hair)\b/i,
  ],
  ["painting", /\b(?:paint\w*|repaint\w*|render\w*|stain\w*|re-?coat\w*)\b/i],
  ["cleaning", /\b(?:clean\w*|steam\w*|vacuum\w*|mop\w*|scrub\w*|pressure\s+wash\w*)\b/i],
];

/**
 * The work word in a service's name decides its trade before any thing it
 * works on: "Interior car clean" is cleaning, "Ceiling paint" is painting.
 */
const WORK_TRADES: [Trade, RegExp][] = [
  ["cleaning", /\b(?:clean\w*|wash\w*|steam\w*|detail\w*)\b/i],
  ["painting", /\b(?:paint\w*|repaint\w*|render\w*|stain\w*)\b/i],
  [
    "beauty",
    /\b(?:make-?up|mani(?:cure)?|pedi(?:cure)?|lash(?:es)?|brows?|wax(?:ing)?|facials?)\b/i,
  ],
];

/** The trade a service belongs to, or undefined when its name says none. */
export function tradeOf(service: string): Trade | undefined {
  return (
    WORK_TRADES.find(([, re]) => re.test(service))?.[0] ??
    SERVICE_TRADES.find(([, re]) => re.test(service))?.[0]
  );
}

/** Every word of the service's name is in the message: it names it, whatever the trade. */
function namedInFull(service: string, message: string): boolean {
  const said = new Set(
    message
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter(Boolean),
  );
  const words = service
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3 && !["and", "the", "for", "with"].includes(w));
  // One bare thing ("Ceilings") is named by any mention of it ("mould on the
  // ceiling"): that is not asking for the service.
  if (words.length < 2 && !WORK_TRADES.some(([, re]) => re.test(service))) return false;
  return (
    words.length > 0 &&
    words.every((w) => said.has(w) || said.has(`${w}s`) || said.has(w.replace(/s$/, "")))
  );
}

/** The trades a message asks for work in. */
export function tradesOf(message: string): Set<Trade> {
  return new Set(MESSAGE_TRADES.filter(([, re]) => re.test(message)).map(([t]) => t));
}

/**
 * Whether a service fits what the message is about: always when either says
 * no trade, otherwise only when the message is about the service's trade.
 */
export function fitsTrade(service: string, message: string): boolean {
  const trade = tradeOf(service);
  if (!trade || namedInFull(service, message)) return true;
  const said = tradesOf(message);
  return said.size === 0 || said.has(trade);
}
