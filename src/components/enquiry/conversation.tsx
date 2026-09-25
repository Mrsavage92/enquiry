import {
  channelLabel,
  formatTime,
  formatWhen,
  identityLine,
  isShortChannel,
  threadLabel,
} from "@/domain/format";
import type { Enquiry, Message } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState, type Ref } from "react";
import { BUSINESS_BY_ID } from "@/fixtures";
import { resolveBusiness } from "@/lib/workspace/resolve-business";
import { usePrototype } from "@/store/prototype-store";
import { QuoteSheet } from "./quote-sheet";
import { concreteWhen } from "@/domain/time-cues";

/**
 * How the embedded (phone) thread splits: what came before, the customer's
 * latest message (always visible - the owner should never have to remember
 * what they asked), and the replies sent after it, folded away.
 */
function splitThread(conversation: Message[]) {
  let lastIn = -1;
  for (let i = conversation.length - 1; i >= 0; i -= 1) {
    if (conversation[i]!.direction === "inbound") {
      lastIn = i;
      break;
    }
  }
  if (lastIn < 0) {
    return { earlier: conversation.slice(0, -1), latest: conversation.slice(-1), after: [] };
  }
  return {
    earlier: conversation.slice(0, lastIn),
    latest: [conversation[lastIn]!],
    after: conversation.slice(lastIn + 1),
  };
}

export function Conversation({
  enquiry,
  compact = false,
  embedded = false,
}: {
  enquiry: Enquiry;
  compact?: boolean;
  embedded?: boolean;
}) {
  const endRef = useRef<HTMLLIElement>(null);
  const channel = enquiry.source;

  useEffect(() => {
    if (embedded) return;
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
  }, [enquiry.conversation.length, compact, embedded]);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        embedded ? "conversation-embedded" : "bg-paper",
        compact || embedded ? "" : "h-full",
      )}
    >
      {compact || embedded ? null : (
        <header className="border-b border-line bg-raised px-6 py-4">
          <p className="eyebrow">{threadLabel(channel)}</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">{enquiry.customerName}</h2>
          <p className="mt-0.5 text-sm text-ink-2">
            {identityLine(enquiry)}
            <span className="text-stone"> · {channelLabel(channel)}</span>
          </p>
        </header>
      )}
      <ol
        className={cn(
          "mx-auto w-full max-w-xl",
          embedded
            ? "px-6 py-6"
            : compact
              ? "px-4 py-4"
              : "min-h-0 flex-1 overflow-y-auto px-6 py-7",
        )}
      >
        {embedded ? (
          <EmbeddedThread enquiry={enquiry} compact={compact} endRef={endRef} />
        ) : (
          enquiry.conversation.map((m, i) => (
            <MessageBlock
              key={m.id}
              message={m}
              enquiry={enquiry}
              compact={compact}
              spaced={i > 0}
              endRef={i === enquiry.conversation.length - 1 ? endRef : undefined}
            />
          ))
        )}
      </ol>
    </div>
  );
}

function EmbeddedThread({
  enquiry,
  compact,
  endRef,
}: {
  enquiry: Enquiry;
  compact: boolean;
  endRef: Ref<HTMLLIElement>;
}) {
  const prefs = usePrototype((s) => s.prefs);
  const { earlier, latest, after } = splitThread(enquiry.conversation);
  return (
    <>
      {earlier.length > 0 ? (
        <li className="conversation-history">
          <details>
            <summary>Earlier messages ({earlier.length})</summary>
            <ol>
              {earlier.map((message, index) => (
                <MessageBlock
                  key={message.id}
                  message={message}
                  enquiry={enquiry}
                  compact={compact}
                  spaced={index > 0}
                />
              ))}
            </ol>
          </details>
        </li>
      ) : null}
      {latest.map((m) => (
        <MessageBlock
          key={m.id}
          message={m}
          enquiry={enquiry}
          compact={compact}
          spaced={false}
          endRef={after.length === 0 ? endRef : undefined}
        />
      ))}
      {after.map((m, i) => (
        <li key={m.id} className="conversation-history mt-4">
          <details>
            <summary>
              Your reply, sent {concreteWhen(m.at, new Date(), prefs.timezone || undefined)}
            </summary>
            <ol>
              <MessageBlock
                message={m}
                enquiry={enquiry}
                compact={compact}
                spaced={false}
                endRef={i === after.length - 1 ? endRef : undefined}
              />
            </ol>
          </details>
        </li>
      ))}
    </>
  );
}

function MessageBlock({
  message: m,
  enquiry,
  compact = false,
  spaced,
  endRef,
}: {
  message: Message;
  enquiry: Enquiry;
  compact?: boolean;
  spaced: boolean;
  endRef?: Ref<HTMLLIElement>;
}) {
  const businesses = usePrototype((s) => s.businesses);
  const demoMode = usePrototype((s) => s.demoMode);
  const business = resolveBusiness(businesses, enquiry.businessId, {
    demoMode,
    fixtures: BUSINESS_BY_ID,
  });
  const outbound = m.direction === "outbound";
  const quote = m.quoteId ? enquiry.decision.quotes.find((q) => q.id === m.quoteId) : undefined;
  const short = isShortChannel(m.channel);
  const form = m.channel === "form";
  const comment = m.channel === "comment";
  const chat = compact || short;

  if (chat && !form && !comment) {
    return (
      <li ref={endRef} className={cn(spaced && "mt-5")}>
        <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
          <div className={cn("max-w-[90%]", outbound && "text-right")}>
            <p className="text-2xs font-medium text-stone">
              {outbound ? "Sent" : "Received"}
              <span className="tabular-nums text-stone"> · {formatTime(m.at)}</span>
            </p>
            <ClampedMessage
              body={m.body}
              clamp={compact && !outbound}
              className={cn("msg mt-1 text-left", outbound ? "msg-out ml-auto" : "msg-in")}
              textClassName={cn("whitespace-pre-wrap", !short && "letter-body font-serif")}
            />
          </div>
        </div>
      </li>
    );
  }

  return (
    <li ref={endRef} className={cn(spaced && "mt-10")}>
      <div className="message-meta flex items-baseline justify-between gap-3">
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
          {/* On a phone the answers table would push the next step below the
              fold, so the message leads and the table waits behind one tap. */}
          {compact ? (
            <>
              {m.body ? <p className="mt-3 text-sm leading-relaxed text-ink-2">{m.body}</p> : null}
              <details className="form-answers mt-2">
                <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-mark-strong">
                  Show form answers ({m.formFields.length})
                </summary>
                <FormFields fields={m.formFields} />
              </details>
            </>
          ) : (
            <>
              <FormFields fields={m.formFields} />
              {m.body ? <p className="mt-3 text-sm leading-relaxed text-ink-2">{m.body}</p> : null}
            </>
          )}
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
          <div
            className={cn("message-letter", outbound ? "message-letter-out" : "message-letter-in")}
          >
            {m.subject ? (
              <p className="message-subject mt-4 font-serif text-xl font-medium leading-snug tracking-tight">
                {m.subject}
              </p>
            ) : null}
            {outbound ? (
              <div className="mt-4 rounded-lg bg-raised px-5 py-4 shadow-border">
                <p className="letter-body whitespace-pre-wrap text-ink-2">{m.body}</p>
              </div>
            ) : (
              <p className="letter-body mt-4 whitespace-pre-wrap">{m.body}</p>
            )}
          </div>
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

/** Past this, a customer's message pushes the next step off a phone screen. */
const LONG_MESSAGE_CHARS = 220;
const LONG_MESSAGE_LINES = 4;

/**
 * A long customer message on the phone shows its first four lines and "Show
 * all", so the next step and its button stay above the fold. Nothing is cut:
 * one tap shows every word, and the desk shows it in full.
 */
function ClampedMessage({
  body,
  clamp,
  className,
  textClassName,
}: {
  body: string;
  clamp: boolean;
  className: string;
  textClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const long =
    clamp && (body.length > LONG_MESSAGE_CHARS || body.split("\n").length > LONG_MESSAGE_LINES);
  return (
    <>
      <div className={className}>
        <p className={cn(textClassName, long && !open && "line-clamp-4")}>{body}</p>
      </div>
      {long ? (
        <button
          type="button"
          className="inline-flex min-h-11 items-center text-sm font-medium text-mark-strong"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Show less" : "Show all"}
        </button>
      ) : null}
    </>
  );
}

function FormFields({ fields }: { fields: NonNullable<Message["formFields"]> }) {
  return (
    <dl className="mt-3">
      {fields.map((f) => (
        <div
          key={f.label}
          className="flex justify-between gap-4 border-t border-line py-1.5 text-sm first:border-t-0"
        >
          <dt className="text-stone">{f.label}</dt>
          <dd className="text-right">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
