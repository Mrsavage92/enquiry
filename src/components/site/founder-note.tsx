import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/site/contact";

/**
 * Who is behind it, in the founder's own plain words.
 *
 * Structure from 21st efferd testimonials-2 (id 18919): a framed portrait slot
 * pinned by hairlines that run past it, beside the words and a name. There is
 * no photo in public/, so the slot carries initials rather than a stock face.
 *
 * Facts only, all already in this repository: the name and Queensland
 * (src/lib/site/contact.ts) and working alone. No credentials, counts or
 * quotes from anyone else. Do not name family or partners here without their
 * explicit consent.
 */
export const FOUNDER_NOTE = [
  "I'm Adam Savage, and I'm building this on my own in Queensland.",
  "If something doesn't fit how your business works, email me and I'll reply myself.",
] as const;

export function FounderNote() {
  return (
    <section className="public-container founder" aria-labelledby="founder-title">
      <h2 id="founder-title" className="sr-only">
        Who is building it
      </h2>
      <figure className="founder-figure">
        <div className="founder-mark">
          <span className="founder-line founder-line-v founder-line-start" aria-hidden="true" />
          <span className="founder-line founder-line-v founder-line-end" aria-hidden="true" />
          <span className="founder-line founder-line-h founder-line-top" aria-hidden="true" />
          <span className="founder-line founder-line-h founder-line-bottom" aria-hidden="true" />
          <span className="founder-initials" aria-hidden="true">
            AS
          </span>
        </div>
        <figcaption>
          <blockquote>
            <p>{FOUNDER_NOTE.join(" ")}</p>
          </blockquote>
          <p className="founder-name">
            Adam Savage <span>Founder, Queensland</span>
          </p>
          <p className="founder-contact">
            <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>
          </p>
        </figcaption>
      </figure>
    </section>
  );
}
