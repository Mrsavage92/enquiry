import type { Business, Enquiry, QuoteVersion } from "@/domain/types";
import { formatAud } from "@/domain/labels";
import { formatShortDate } from "@/domain/format";
import { resolvedHold } from "@/domain/commercial";
import { quoteSheets } from "@/domain/quote-sheets";
import { cn } from "@/lib/utils";

function statusLine(quote: QuoteVersion, estimate: boolean, customer = false) {
  if (customer) {
    if (quote.status === "accepted") return "Accepted";
    if (estimate) return "Estimate · not a locked number";
    return "Prepared for you";
  }
  if (quote.status === "sent" && quote.sentAt) {
    return `Sent ${formatShortDate(quote.sentAt)} · stays on file`;
  }
  if (quote.status === "accepted") return "Accepted";
  if (quote.status === "superseded") return "Superseded";
  if (estimate) return "Estimate · not a locked number";
  return "Proposed";
}

function amount(quote: QuoteVersion) {
  if (quote.total) return formatAud(quote.total.amount);
  if (quote.range) return `${formatAud(quote.range.min)}–${formatAud(quote.range.max)}`;
  return "-";
}

export function QuoteSheets({
  enquiry,
  business,
  compact = false,
}: {
  enquiry: Enquiry;
  business?: Business;
  compact?: boolean;
}) {
  const sheets = quoteSheets(enquiry);
  if (sheets.length === 0) return null;
  const current = sheets.filter((q) => q.status === "draft" || q.status === "accepted");
  const filed = sheets.filter((q) => q.status === "sent" || q.status === "superseded");
  const estimate = Boolean(sheets.some((q) => q.range && !q.total));

  if (compact) {
    const focus = current[current.length - 1] ?? sheets[sheets.length - 1];
    const isEstimate = estimate || Boolean(focus.range && !focus.total);
    const hold = resolvedHold(focus);
    return (
      <section className="px-5 pb-3 pt-5" aria-label="Quote">
        <p
          className={cn(
            "font-serif text-4xl tabular-nums tracking-tight",
            isEstimate ? "commercial-estimate" : "commercial-exact",
          )}
        >
          {amount(focus)}
        </p>
        {hold ? (
          <p className="mt-1.5 text-sm text-ink-2">{formatAud(hold.amount)} holds the date</p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="border-b border-line px-5 py-5" aria-label="Quote">
      <p className="eyebrow">{sheets.length > 1 ? "Quote versions" : "Quote"}</p>
      <div className="mt-3 space-y-3">
        {filed.map((q) => (
          <QuoteSheet
            key={q.id}
            quote={q}
            enquiry={enquiry}
            business={business}
            filed
            hasRevision={current.length > 0}
          />
        ))}
        {current.map((q) => (
          <QuoteSheet
            key={q.id}
            quote={q}
            enquiry={enquiry}
            business={business}
            estimate={estimate}
          />
        ))}
      </div>
    </section>
  );
}

export function QuoteSheet({
  quote,
  enquiry,
  business,
  filed = false,
  estimate = false,
  hasRevision = false,
  customer = false,
  compact = false,
}: {
  quote: QuoteVersion;
  enquiry: Enquiry;
  business?: Business;
  filed?: boolean;
  estimate?: boolean;
  hasRevision?: boolean;
  customer?: boolean;
  compact?: boolean;
}) {
  const isEstimate = estimate || Boolean(quote.range && !quote.total);
  const hold = resolvedHold(quote);
  return (
    <article
      className={cn("quote-sheet", filed && "quote-sheet-filed")}
      aria-label={`Quote version ${quote.version}`}
      data-quote-status={quote.status}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium tracking-tight">{business?.name ?? "Quote"}</p>
          <p className="mt-0.5 text-2xs text-stone">
            {business?.city}
            {business?.ownerName ? ` · ${business.ownerName}` : ""}
          </p>
        </div>
        <p className="eyebrow text-right">Version {quote.version}</p>
      </header>
      <p className="mt-3 text-xs text-ink-2">{statusLine(quote, isEstimate, customer)}</p>
      <p className="mt-4 text-sm">
        <span className="text-stone">To </span>
        {enquiry.customerName}
      </p>
      <p className="mt-0.5 text-sm text-ink-2">
        {enquiry.serviceLabel}
        {enquiry.dateLabel ? ` · ${enquiry.dateLabel}` : ""}
        {enquiry.locationLabel ? ` · ${enquiry.locationLabel}` : ""}
      </p>
      {quote.lineItems.length > 0 ? (
        <ul className="mt-4 border-t border-line">
          {quote.lineItems.map((item) => (
            <li
              key={item.id}
              className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-sm"
            >
              <span>{item.label}</span>
              <span className="font-serif tabular-nums">{formatAud(item.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 border-t border-line" />
      )}
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-2xs font-semibold uppercase tracking-wider text-stone">
          {isEstimate ? "Estimate" : "Total"}
        </p>
        <p
          className={cn(
            "font-serif tabular-nums tracking-tight",
            compact ? "text-3xl" : "text-2xl",
            isEstimate ? "commercial-estimate" : "commercial-exact",
          )}
        >
          {amount(quote)}
        </p>
      </div>
      {hold ? (
        <p className="mt-3 text-sm text-ink-2">
          {hold.label ?? "To hold the date"} · {formatAud(hold.amount)}. Balance on the day.
          {customer ? " No card is taken here." : ""}
        </p>
      ) : null}
      {quote.assumptions.length > 0 ? (
        <ul className="mt-3 space-y-0.5">
          {quote.assumptions.map((a) => (
            <li key={a} className="text-xs text-stone">
              {a}
            </li>
          ))}
        </ul>
      ) : null}
      {quote.ruleSetVersion ? (
        <p className="mt-3 text-2xs text-stone">{quote.ruleSetVersion}</p>
      ) : null}
      {filed && !customer ? (
        <p className="mt-3 text-xs text-ink-2">
          {hasRevision
            ? "This sheet is not rewritten. A new version is proposed below."
            : "This sheet stays on file."}
        </p>
      ) : null}
      {customer || compact ? null : (
        <div className="mt-3 flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            className="inline-flex min-h-11 items-center text-xs font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline"
            onClick={() => window.print()}
          >
            Print this sheet
          </button>
        </div>
      )}
    </article>
  );
}
