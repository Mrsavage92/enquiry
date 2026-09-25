/**
 * The founding offer, in one place.
 *
 * Every page, the FAQ, Terms and the welcome email read from here, and a test
 * fails if any of them restates a price or discount in its own words. Change
 * the offer here and nowhere else.
 *
 * Decided 2026-09-25 (research 49): founding members pay A$15 a month for as
 * long as they stay subscribed, from day one, with a first-month refund.
 */

export const FOUNDING_PRICE = "A$15";
export const STANDARD_PRICE = "A$29";

/**
 * When the founding window closes, as shown to people ("30 November 2026").
 * null means "open until public launch", with 14 days' notice promised.
 */
export const FOUNDING_CLOSES: string | null = null;

/**
 * The Stripe Payment Link for the founding plan (A$15/month, inc GST).
 * Empty until Stripe is set up; while empty the site collects the list and
 * promises the founding price to everyone on it, and never says "pay today".
 */
export const FOUNDING_PAYMENT_LINK = "";

export const paymentsOpen = FOUNDING_PAYMENT_LINK !== "";

/**
 * The one sentence about when money changes hands, used everywhere while
 * payments are not open. Do not restate it in other words on any page.
 */
const PAYMENT_TIMING = `No card today. You pay ${FOUNDING_PRICE} from the day you start using it, and your first month is refundable.`;

export const OFFER = {
  name: "Founding member",
  /** The one-line offer. */
  headline: `${FOUNDING_PRICE} a month, for as long as you stay.`,
  /** Hero and invite band. Unambiguous about who pays what, and from when. */
  short: `Join now: ${FOUNDING_PRICE} a month, locked for as long as you stay. Everyone who joins after launch pays ${STANDARD_PRICE}.`,
  after: `Businesses that join after the founding window pay ${STANDARD_PRICE} a month.`,
  window: FOUNDING_CLOSES
    ? `Open until ${FOUNDING_CLOSES}.`
    : "Open until we launch publicly. We'll give at least 14 days' notice before it closes.",
  refund: "Not earning its keep? We refund your first month, no questions. Cancel any time.",
  start: paymentsOpen ? "Pay today and you're in today." : PAYMENT_TIMING,
  /** What happens after joining the list, in order. Only what is true today. */
  next: "We email you when your place opens, and everyone on the list keeps the founding price.",
  /** The invite band lede: the two prices, nothing else. */
  band: `${FOUNDING_PRICE} a month while you stay. ${STANDARD_PRICE} after launch.`,
  gst: "Prices include GST.",
  /** Appended to OFFER.short on the hero note while payments are not open. */
  noteSuffix: ` ${PAYMENT_TIMING}`,
  /** The small line under the invite-band form while payments are not open. */
  reassure: PAYMENT_TIMING,
  /** The /early-access page heading, once payments are not open. */
  entryHeadline: `Lock in ${FOUNDING_PRICE} a month.`,
  entrySub: `Founding price, kept for as long as you stay. ${STANDARD_PRICE} for everyone after launch.`,
} as const;

/** The promises card on /early-access. */
export const OFFER_PROMISES = [
  { t: "Your first month is refundable", b: OFFER.refund },
  {
    t: "Setup help from a person",
    b: "Tell us your services and prices and we help you set them up, so your first real enquiry has something to price against.",
  },
  {
    t: "Your price never goes up",
    b: `While you stay subscribed you pay ${FOUNDING_PRICE} a month. No higher tier to be moved onto, and nothing else is charged.`,
  },
  {
    t: "A direct line into what we build",
    b: "What founding members tell us shapes what gets built next, and we publish what changed.",
  },
] as const;

/** FAQ answers that state the offer. */
export const OFFER_FAQ = {
  cost: `${OFFER.short} ${OFFER.gst} ${paymentsOpen ? OFFER.refund : OFFER.start}`,
  joining: `${OFFER.start} ${OFFER.window}`,
  leaving:
    "Once you are paying, cancel any time, no call or reason needed. If it hasn't earned its keep in your first month, we refund that month.",
} as const;

/**
 * The binding version, used on /terms. Keep the conditions here, not in
 * marketing copy.
 */
export const OFFER_TERMS = `The founding rate of ${FOUNDING_PRICE} a month (inc GST) applies to one business on the founding plan for as long as its subscription stays active. It ends if the subscription is cancelled for more than 30 days, and it cannot be transferred. While it applies we will not raise the founding rate or charge anything else for the founding plan. If you ask within 30 days of your first charge, we refund that first month. The founding rate is available until ${FOUNDING_CLOSES ?? "we launch publicly, with at least 14 days' notice before it closes"}, and no business joining after that will be offered it. Products or add-ons released later may be priced separately and are never needed to keep the founding plan. If we stop offering the service we will give at least 60 days' notice and refund any prepaid period.`;
