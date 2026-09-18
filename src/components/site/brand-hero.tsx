import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUpRight, Pause, Play } from "lucide-react";

export function BrandHero() {
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [visible, setVisible] = useState(true);
  const hero = useRef<HTMLElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(media.matches);
    syncMotion();
    media.addEventListener("change", syncMotion);
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.intersectionRatio > 0.15),
      { threshold: [0, 0.15] },
    );
    if (hero.current) observer.observe(hero.current);
    return () => {
      media.removeEventListener("change", syncMotion);
      observer.disconnect();
    };
  }, []);

  return (
    <section
      ref={hero}
      className="brand-hero"
      aria-labelledby="home-title"
      data-motion={!paused && !reducedMotion && visible ? "playing" : "paused"}
    >
      <div className="brand-hero-art" aria-hidden="true">
        <picture>
          <source media="(max-width: 600px)" srcSet="/brand/signal-ribbon-mobile.webp" />
          <img
            src="/brand/signal-ribbon.webp"
            alt=""
            width="1942"
            height="809"
            fetchPriority="high"
          />
        </picture>
      </div>
      <div className="brand-hero-copy">
        <p className="brand-hero-category">
          For painters, cleaners, mobile beauty and other service businesses that quote before they
          book.
        </p>
        <h1 id="home-title">
          Enquiry<span>.</span>
        </h1>
        <p className="brand-hero-promise">
          Know what you can safely promise
          <br />
          before you reply.
        </p>
        <p className="brand-hero-description">
          It checks the request against how your business works, asks only for the detail
          <br className="brand-desktop-break" /> that would change the answer, and prepares the
          reply. You still send it.
        </p>
        <div className="brand-hero-actions">
          <Link to="/early-access" className="brand-hero-join">
            Join early access <ArrowUpRight size={19} aria-hidden="true" />
          </Link>
          <Link to="/demo" className="brand-hero-demo">
            Explore the demo <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <p className="brand-hero-note">
          Indicative pricing from A$29 a month. The first 20 businesses get 30% off for 12 months.
        </p>
      </div>
      <div className="brand-hero-footer">
        <a href="#product-preview" className="brand-hero-explore">
          <ArrowDown size={16} aria-hidden="true" /> A closer look
        </a>
        {!reducedMotion ? (
          <button
            type="button"
            className="brand-motion-toggle"
            onClick={() => setPaused((value) => !value)}
            aria-label={paused ? "Play background motion" : "Pause background motion"}
            title={paused ? "Play background motion" : "Pause background motion"}
          >
            {paused ? (
              <Play size={15} aria-hidden="true" />
            ) : (
              <Pause size={15} aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>
    </section>
  );
}
