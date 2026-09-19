import { useEffect, useRef, useState } from "react";
import { CalendarDays, MessageSquareText, Settings2 } from "lucide-react";
import { PhoneFrame } from "@/components/site/device-frame";
import { cn } from "@/lib/utils";

/**
 * Sticky scroll walkthrough of the three real product captures.
 *
 * The capture stays pinned while three short steps scroll past it; whichever
 * step sits in the middle band of the viewport decides which capture shows.
 * Structure adapted from 21st.dev hyperiux sticky-content-wrapper (id 26064),
 * which pins with GSAP ScrollTrigger. That would be a new runtime dependency
 * for one section, so this uses `position: sticky` plus the same
 * IntersectionObserver pattern as `Reveal` in motion.tsx instead.
 *
 * Below 860px the pinned stage is hidden and each step carries its own
 * capture inline, so nothing depends on scroll position on a phone. The swap
 * has no animation under prefers-reduced-motion (see public-site.css).
 */
const STEPS = [
  {
    id: "today",
    label: "Your day",
    icon: CalendarDays,
    title: "Start with what needs you.",
    body: "Enquiries waiting on a decision sit at the top, next to the day's calendar. No dashboard to decode before you can begin.",
    alt: "The Today screen of the sample workspace, with enquiries needing attention beside the day's calendar.",
  },
  {
    id: "enquiry",
    label: "The next reply",
    icon: MessageSquareText,
    title: "Open one enquiry. Read the prepared next step.",
    body: "The customer conversation comes first. Under it, a prepared reply and the details still unresolved, ready for your review. You still send.",
    alt: "An enquiry in the sample workspace, showing the customer conversation, a prepared reply and unresolved details.",
  },
  {
    id: "business",
    label: "Your business",
    icon: Settings2,
    title: "Teach it your business in plain words.",
    body: "Services, pricing, availability and policies, written the way you would say them. Rules with real consequences wait for your explicit yes.",
    alt: "Business settings in the sample workspace, listing services, pricing, availability, policies and voice and tone.",
  },
] as const;

function Capture({ id, alt, eager = false }: { id: string; alt: string; eager?: boolean }) {
  return (
    <picture>
      <source media="(max-width: 600px)" srcSet={`/product/ui1/${id}-mobile.jpg`} />
      <img
        src={`/product/ui1/${id}-desktop.jpg`}
        alt={alt}
        width="1440"
        height="960"
        loading={eager ? "eager" : "lazy"}
      />
    </picture>
  );
}

export function ProductWalkthrough() {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    const steps = stepRefs.current.filter((el): el is HTMLLIElement => el !== null);
    if (steps.length === 0 || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((entry) => entry.isIntersecting);
        if (!hit) return;
        const index = Number((hit.target as HTMLElement).dataset.step);
        if (!Number.isNaN(index)) setActive(index);
      },
      { rootMargin: "-42% 0px -42% 0px", threshold: 0 },
    );
    steps.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const current = STEPS[active];

  return (
    <section className="public-walkthrough" aria-labelledby="walkthrough-title">
      <div className="public-container public-walkthrough-inner">
        <div className="public-walkthrough-copy">
          <div className="public-section-heading">
            <p className="public-kicker">Then, in the app</p>
            <h2 id="walkthrough-title">Three screens carry most of the day.</h2>
            <p>What you open first, what you review, and how it learns your business.</p>
          </div>
          <ol className="public-walkthrough-steps">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.id}
                  data-step={index}
                  ref={(el) => {
                    stepRefs.current[index] = el;
                  }}
                  className={cn("public-walk-step", active === index && "is-active")}
                >
                  <span className="public-walk-index" aria-hidden="true">
                    0{index + 1}
                  </span>
                  <div className="public-walk-body">
                    <p className="public-walk-label">
                      <Icon size={15} aria-hidden="true" />
                      {step.label}
                    </p>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                    <figure className="public-walk-inline">
                      <Capture id={step.id} alt={step.alt} />
                    </figure>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
        <figure className="public-walkthrough-stage">
          <PhoneFrame className="public-walkthrough-phone">
            <div className="public-walkthrough-media">
              {STEPS.map((step, index) => (
                <div key={step.id} hidden={active !== index}>
                  <img
                    src={`/product/ui1/${step.id}-mobile.jpg`}
                    alt={step.alt}
                    width="390"
                    height="600"
                    loading="eager"
                  />
                </div>
              ))}
            </div>
          </PhoneFrame>
          <figcaption>
            <span className="public-sample-label">
              Actual app · sample workspace · {current.label}
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
