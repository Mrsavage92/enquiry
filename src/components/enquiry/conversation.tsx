import { channelLabel, formatTime, formatWhen, identityLine, isShortChannel, threadLabel } from "@/domain/format";
import type { Enquiry, Message } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useEffect, useRef, type Ref } from "react";
import { BUSINESS_BY_ID } from "@/fixtures";
import { usePrototype } from "@/store/prototype-store";
import { QuoteSheet } from "./quote-sheet";

export function Conversation({ enquiry, compact = false }: { enquiry: Enquiry; compact?: boolean }) {
  const endRef = useRef<HTMLLIElement>(null);
  const channel = enquiry.source;

  useEffect(() => {
    const el = endRef.current;
    if (!el) return;
    let pane: HTMLElement | null = el.parentElement;
    while (pane && pane !== document.body) {
      const oy = getComputedStyle(pane).overflowY;
      if (oy === "auto" || oy === "scroll") {
        pane.scrollTop = pane.scrollHeight;
        return;
      }
      pane = pane.parentElement;
    }
  }, [enquiry.conversation.length, compact]);

  return (
    <div className={cn("flex min-h-0 flex-col bg-paper", compact ? "" : "h-full")}>
      {compact ? null : (
        <header className="border-b border-line bg-raised px-6 py-4">
          <p className="eyebrow">{threadLabel(channel)}</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">{enquiry.customerName}</h2>
          <p className="mt-0.5 text-sm text-ink-2">
            {identityLine(enquiry)}
            <span className="text-stone"> · {channelLabel(channel)}</span>
          </p>
        </header>
      )}
      <ol className={cn("mx-auto w-full max-w-xl", compact ? "px-4 py-4" : "min-h-0 flex-1 overflow-y-auto px-6 py-7")}>
        {enquiry.conversation.map((m, i) => (
          <MessageBlock
            key={m.id}
            message={m}
            enquiry={enquiry}
            compact={compact}
            last={i === enquiry.conversation.length - 1}
            spaced={i > 0}
            endRef={i === enquiry.conversation.length - 1 ? endRef : undefined}
          />
        ))}
      </ol>
    </div>
  );
}

function MessageBlock({
  message: m,
  enquiry,
  compact = false,
  last,
  spaced,
  endRef,
}: {
  message: Message;
  enquiry: Enquiry;
  compact?: boolean;
  last: boolean;
  spaced: boolean;
  endRef?: Ref<HTMLLIElement>;
}) {
  const businesses = usePrototype((s) => s.businesses);
  const business = businesses.find((b) => b.id === enquiry.businessId) ?? BUSINESS_BY_ID[enquiry.businessId];
  const outbound = m.direction === "outbound";
  const quote = m.quoteId ? enquiry.decision.quotes.find((q) => q.id === m.quoteId) : undefined;
  const short = isShortChannel(m.channel);
  const form = m.channel === "form";
  const comment = m.channel === "comment";
  const chat = compact || short;

  if (chat && !form && !comment) {
    return (
      <li
        ref={endRef}
        className={cn(spaced && "mt-5", last && "animate-[rise-in_320ms_var(--ease-smooth-out)]")}
      >
        <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
          <div className={cn("max-w-[90%]", outbound && "text-right")}>
            <p className="text-2xs font-medium text-stone">
              {outbound ? "Sent" : "Received"}
              <span className="tabular-nums text-stone/80"> · {formatTime(m.at)}</span>
            </p>
            <div className={cn("msg mt-1 text-left", outbound ? "msg-out ml-auto" : "msg-in")}>
              <p className={cn("whitespace-pre-wrap", !short && "letter-body font-serif")}>{m.body}</p>
            </div>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li
      ref={endRef}
      className={cn(spaced && "mt-10", last && "animate-[rise-in_320ms_var(--ease-smooth-out)]")}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{m.from}</p>
        <p className="shrink-0 text-2xs tabular-nums text-stone">{formatWhen(m.at)}</p>
      </div>
      <p className="mt-0.5 text-2xs font-semibold uppercase tracking-wider text-stone">
        {outbound ? "Sent" : "Received"} · {channelLabel(m.channel)}
      </p>
      {m.commentContext ? <p className="mt-1 text-xs text-stone">{m.commentContext}</p> : null}

      {form && m.formFields?.length ? (
        <div className="mt-4 rounded-lg bg-raised px-5 py-4 shadow-border">
          <p className="eyebrow">Submitted on the website</p>
          <dl className="mt-3">
            {m.formFields.map((f) => (
              <div key={f.label} className="flex justify-between gap-4 border-t border-line py-1.5 text-sm first:border-t-0">
                <dt className="text-stone">{f.label}</dt>
                <dd className="text-right">{f.value}</dd>
              </div>
            ))}
          </dl>
          {m.body ? <p className="mt-3 text-sm leading-relaxed text-ink-2">{m.body}</p> : null}
        </div>
      ) : comment ? (
        <blockquote className="mt-4 border-l-2 border-ink pl-4">
          <p className="text-sm leading-relaxed">{m.body}</p>
          <p className="mt-2 text-xs text-stone">
            {outbound ? "Public reply. Not a quote." : "Public. Enquiry will not quote here."}
          </p>
        </blockquote>
      ) : (
        <>
          {m.subject ? (
            <p className="mt-4 font-serif text-xl font-medium leading-snug tracking-tight">{m.subject}</p>
          ) : null}
          {outbound ? (
            <div className="mt-4 rounded-lg bg-raised px-5 py-4 shadow-border">
              <p className="letter-body whitespace-pre-wrap text-ink-2">{m.body}</p>
            </div>
          ) : (
            <p className="letter-body mt-4 whitespace-pre-wrap">{m.body}</p>
          )}
        </>
      )}

      {quote && !compact ? (
        <div className="mt-4">
          <QuoteSheet quote={quote} enquiry={enquiry} business={business} />
        </div>
      ) : null}
    </li>
  );
}
