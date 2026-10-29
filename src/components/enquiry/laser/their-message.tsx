import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Enquiry } from "@/domain/types";
import { Conversation } from "../conversation";

/**
 * Slot M: the customer's latest message, as a two-line excerpt that opens in
 * place (doc 50 section 3). Open from the start on the desktop, and on the
 * phone while the owner is asked what the price covers, because that question
 * cannot be answered honestly from two lines; open, it is capped at eight
 * lines with "Show all", so the question's first button stays on screen.
 */
export function TheirMessage({ enquiry, startOpen }: { enquiry: Enquiry; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [all, setAll] = useState(false);
  const [thread, setThread] = useState(false);
  const inbound = enquiry.conversation.filter((m) => m.direction === "inbound");
  const latest = inbound[inbound.length - 1];
  const earlier = enquiry.conversation.length - 1;
  const lines = (
    latest?.formFields?.length
      ? latest.formFields.map((f) => `${f.label}: ${f.value}`).join("\n")
      : (latest?.body ?? "")
  ).trim();

  return (
    <section className="laser-message" aria-label="Their message">
      {latest ? (
        <button
          type="button"
          className="laser-message-toggle"
          aria-expanded={open}
          onClick={() => {
            setOpen((o) => !o);
            setAll(false);
          }}
        >
          <span
            className="laser-message-text"
            data-clamp={open ? (all ? "none" : "8") : "2"}
            data-count="customer"
          >
            {lines}
          </span>
          <ChevronDown
            size={18}
            aria-hidden
            className="laser-chevron"
            data-open={open || undefined}
          />
          <span className="sr-only">{open ? "Show less" : "Show their whole message"}</span>
        </button>
      ) : null}
      {open && !all && lines.split("\n").length > 8 ? (
        <button type="button" className="laser-link" onClick={() => setAll(true)}>
          Show all
        </button>
      ) : null}
      {enquiry.notes ? (
        <p className="laser-note">
          <span className="font-medium text-ink">Your note:</span>{" "}
          <span data-count="customer">{enquiry.notes}</span>
        </p>
      ) : null}
      {earlier > 0 ? (
        <>
          <button
            type="button"
            className="laser-link"
            aria-expanded={thread}
            onClick={() => setThread((t) => !t)}
          >
            Earlier messages ({earlier})
          </button>
          {thread ? <Conversation enquiry={enquiry} compact embedded /> : null}
        </>
      ) : null}
    </section>
  );
}
