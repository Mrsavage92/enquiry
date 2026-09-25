/**
 * Money as a customer reads it. Whole dollars stay whole ("$190"); anything
 * with cents always shows two places ("$4.50", never "$4.5").
 */

/** Minor units (cents) -> "$1,200" or "$4.50". */
export function formatMinorAud(amountMinor: number, currency = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

/** A rule's major-unit amount -> "$190" or "$4.50", as written in workings. */
export function formatMajorAmount(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}
