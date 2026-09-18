import { useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useArrowGroup } from "@/components/site/use-arrow-group";
import { CalendarDays, MessageSquareText, Settings2 } from "lucide-react";
import { BrowserFrame } from "@/components/site/device-frame";

const VIEWS = [
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

export function ProductShowcase() {
  const [selected, setSelected] = useState(1);
  const panelId = useId();
  const view = VIEWS[selected];
  const { onKeyDown, bind } = useArrowGroup(VIEWS.length, selected, setSelected);
  return (
    <section id="product-preview" className="public-showcase" aria-label="Explore the actual app">
      <div className="public-showcase-heading">
        <p>One enquiry. One detail still deciding it.</p>
        <span>
          Built in the open. Every change is posted to <Link to="/updates">Updates</Link>.
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
        <BrowserFrame
          tone="light"
          url={`Sample workspace · ${view.label}`}
          className="public-product-frame"
        >
          <div className="public-product-media">
            {VIEWS.map((item, index) => (
              <picture key={item.id} hidden={selected !== index}>
                <source media="(max-width: 600px)" srcSet={`/product/ui1/${item.id}-mobile.jpg`} />
                <img
                  src={`/product/ui1/${item.id}-desktop.jpg`}
                  alt={item.alt}
                  width="1440"
                  height="960"
                  loading={index === 1 ? "eager" : "lazy"}
                  fetchPriority="auto"
                />
              </picture>
            ))}
          </div>
        </BrowserFrame>
        <figcaption>
          <span aria-live="polite">{view.caption}</span>
          <span className="public-sample-label">Actual app · sample workspace</span>
        </figcaption>
      </figure>
    </section>
  );
}
