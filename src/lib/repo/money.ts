import type { Money, MoneyRange } from "@/domain/types";

/**
 * Money crosses one boundary in this app and it is the only place it can go
 * wrong: the domain speaks major units (`{ amount: 625 }` is $625) and Postgres
 * stores integer minor units, because storing currency as a float eventually
 * produces a quote that is a cent off and a customer who is right to complain.
 *
 * Rounding is applied on the way IN, once, so a fractional major amount can
 * never smear across a later multiplication.
 */

/** Major units -> integer minor units. Rounds half away from zero. */
export function toMinor(amount: number): number {
  if (!Number.isFinite(amount)) throw new RangeError(`Not a finite amount: ${amount}`);
  return Math.round(amount * 100);
}

/** Integer minor units -> major units. */
export function fromMinor(minor: number): number {
  return minor / 100;
}

/** Domain Money -> the column pair Postgres holds. */
export function moneyToColumns(
  money: Money | undefined | null,
): { minor: number | null; currency: string | null } {
  if (!money) return { minor: null, currency: null };
  return { minor: toMinor(money.amount), currency: money.currency };
}

/** Column pair -> domain Money, or undefined when the value was never set. */
export function moneyFromColumns(
  minor: number | string | null | undefined,
  currency: string | null | undefined,
): Money | undefined {
  if (minor === null || minor === undefined) return undefined;
  // pg returns bigint as string on some paths; db.ts normalises int8 to number,
  // but accept both so a mapper is never silently wrong about a price.
  const n = typeof minor === "string" ? Number(minor) : minor;
  if (!Number.isFinite(n)) return undefined;
  return { amount: fromMinor(n), currency: (currency ?? "AUD") as Money["currency"] };
}

/** Column triple -> domain MoneyRange, or undefined when either bound is unset. */
export function moneyRangeFromColumns(
  minMinor: number | string | null | undefined,
  maxMinor: number | string | null | undefined,
  currency: string | null | undefined,
): MoneyRange | undefined {
  const min = moneyFromColumns(minMinor, currency);
  const max = moneyFromColumns(maxMinor, currency);
  if (!min || !max) return undefined;
  return { min: min.amount, max: max.amount, currency: min.currency };
}
