import { useEffect, useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useArrowGroup } from "@/components/site/use-arrow-group";
import { CalendarDays, CircleCheck, MessageSquareText, Settings2 } from "lucide-react";
import { BrowserFrame } from "@/components/site/device-frame";
import { CrossChannelDecisionDemo } from "@/components/site/cross-channel-decision-demo";

/**
 * The first view is the live sample decision (the same data as /demo), so the
 * Yes / No / Not yet answer is visible on home without a click. The other
 * three are real captures of the app.
 */
const VIEWS = [
  {
    id: "decision",
    label: "The answer",
    icon: CircleCheck,
    caption: "Same message, two businesses. Switch either toggle and the answer moves with it.",
    alt: "",
  },
  {
    id: "today",
    label: "Your day",
    icon: CalendarDays,
    caption: "What needs a decision today, and nothing else.",
    alt: "Enquiry Today screen with enquiries needing attention and the day's calendar.",
  },
  {
    id: "enquiry",
    label: "The next reply",
    icon: MessageSquareText,
    caption:
      "The conversation, the one detail still blocking the price, and the reply it prepared.",
    alt: "An enquiry in Enquiry, showing the customer conversation, a prepared reply and unresolved details.",
  },
  {
    id: "business",
    label: "Your business",
    icon: Settings2,
    caption: "Your services, prices and rules, in your words. These decide the answer.",
    alt: "Enquiry Business settings with services, pricing, availability, policies and voice and tone.",
  },
] as const;

export function ProductShowcase({
  initialView,
}: {
  /** From /?view=; the URL mirrors the selection afterwards so a view is linkable. */
  initialView?: (typeof VIEWS)[number]["id"];
}) {
  const initialIndex = Math.max(
    0,
    VIEWS.findIndex((item) => item.id === (initialView ?? "decision")),
  );
  const [selected, setSelected] = useState(initialIndex);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const id = VIEWS[selected].id;
    if (id === "decision") url.searchParams.delete("view");
    else url.searchParams.set("view", id);
    window.history.replaceState(window.history.state, "", url);
  }, [selected]);
  const panelId = useId();
  const view = VIEWS[selected];
  const live = view.id === "decision";
  const { onKeyDown, bind } = useArrowGroup(VIEWS.length, selected, setSelected);
  return (
    <section id="product-preview" className="public-showcase" aria-label="Explore the actual app">
      <div className="public-showcase-heading">
        <p>One enquiry. One detail still deciding it.</p>
        <span>
          Built in the open. Meaningful progress is posted to <Link to="/updates">Updates</Link>.
        </span>
      </div>
      <div
        className="public-showcase-controls"
        role="group"
        aria-label="Product views"
        onKeyDown={onKeyDown}
      >
        {VIEWS.map(({ id, icon: Icon, label }, index) => (
          <button
            key={id}
            ref={bind(index)}
            type="button"
            aria-pressed={selected === index}
            aria-controls={panelId}
            onClick={() => setSelected(index)}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <figure id={panelId} className="public-product-figure">
        <div className="public-decision-panel" hidden={selected !== 0}>
          <CrossChannelDecisionDemo summary />
        </div>
        <BrowserFrame
          tone="light"
          url={`Sample workspace · ${view.label}`}
          className={live ? "public-product-frame hidden" : "public-product-frame"}
        >
          <div className="public-product-media">
            {VIEWS.slice(1).map((item, offset) => {
              const index = offset + 1;
              return (
                <picture key={item.id} hidden={selected !== index}>
                  <source
                    media="(max-width: 600px)"
                    srcSet={`/product/ui1/${item.id}-mobile.jpg`}
                  />
                  <img
                    src={`/product/ui1/${item.id}-desktop.jpg`}
                    alt={item.alt}
                    width="1440"
                    height="960"
                    loading="lazy"
                  />
                </picture>
              );
            })}
          </div>
        </BrowserFrame>
        <figcaption>
          <span aria-live="polite">{view.caption}</span>
          <span className="public-sample-label">
            {live ? "Sample demo · not a real customer" : "Actual app · sample workspace"}
          </span>
        </figcaption>
      </figure>
    </section>
  );
}
