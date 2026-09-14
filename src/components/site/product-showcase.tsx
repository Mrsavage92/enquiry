import { useId, useState } from "react";
import { CalendarDays, MessageSquareText, Settings2 } from "lucide-react";

const VIEWS = [
  {
    id: "today",
    label: "Your day",
    icon: CalendarDays,
    caption: "The next work, without the dashboard overload.",
    alt: "Enquiry Today screen with enquiries needing attention and the day's calendar.",
  },
  {
    id: "enquiry",
    label: "The next reply",
    icon: MessageSquareText,
    caption: "The conversation first. A prepared next step, ready for your review.",
    alt: "An enquiry in Enquiry, showing the customer conversation, a prepared reply and unresolved details.",
  },
  {
    id: "business",
    label: "Your business",
    icon: Settings2,
    caption: "Services, pricing and policies, in words that make sense.",
    alt: "Enquiry Business settings with services, pricing, availability, policies and voice and tone.",
  },
] as const;

export function ProductShowcase() {
  const [selected, setSelected] = useState(0);
  const panelId = useId();
  const view = VIEWS[selected];
  return (
    <div className="public-showcase">
      <div className="public-showcase-controls" role="group" aria-label="Product views">
        {VIEWS.map(({ id, icon: Icon, label }, index) => (
          <button
            key={id}
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
        <div className="public-product-media">
          {VIEWS.map((item, index) => (
            <picture key={item.id} hidden={selected !== index}>
              <source media="(max-width: 600px)" srcSet={`/product/ui1/${item.id}-mobile.jpg`} />
              <img
                src={`/product/ui1/${item.id}-desktop.jpg`}
                alt={item.alt}
                width="1440"
                height="960"
                loading={index === 0 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : "auto"}
              />
            </picture>
          ))}
        </div>
        <figcaption>
          <span aria-live="polite">{view.caption}</span>
          <span className="public-sample-label">Actual app · sample workspace</span>
        </figcaption>
      </figure>
    </div>
  );
}
