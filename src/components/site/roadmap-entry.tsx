import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
  The changelog entry, re-measured from https://linear.app/changelog on
  2026-09-09 (raw values in .style-mirror/reextract/). One entry is one date
  group in the reference: a 12-column grid whose label column sits at 1/4
  against a 1px rule running the group's whole height, and whose body sits at
  4/10.

  The shared .mk-entry-* vocabulary in styles.css already carries the grid, the
  rule (including its -9px overshoot), the marker, the label type and the
  title tiers. The values below are the ones that vocabulary does not carry.
  They are set here as Tailwind arbitrary variants rather than in styles.css;
  each is a reference computed value, not a guess:

    aside      position: sticky; top: 96px   - the reference's .changelogLeft.
               96px is its own 73px header plus 23px clearance, and our nav is
               the same 73px. At <=640 the reference hides the rule and switches
               the column to position: relative; top: 20px.
    lead       margin-top 12px - the reference's first-paragraph-after-a-title
               rhythm - painted in its <strong> tier (weight 590, #f7f8f8).
    prose      margin-top 20px - paragraph after paragraph.
    list       margin-top 12px, padding-left 24px, disc marker in #d0d6e0;
               each item margin-top 8px, first item 0.
    figure     margin-block 48px at 1440, 32px at 390.
*/

const STRONG: CSSProperties = { fontWeight: 590, color: "var(--mk-fg)" };
const QUIET: CSSProperties = { color: "var(--mk-fg-3)" };

export function RoadmapEntry({
  id,
  label,
  note,
  meta,
  marker,
  children,
  ...rest
}: {
  id?: string;
  /** The rail label. The reference puts the date here; the roadmap puts status. */
  label?: string;
  /** An eyebrow above the rail label. Only the stage we are on carries one. */
  note?: string;
  /** Second rail line - the stage number. The reference's rail carries one line. */
  meta?: string;
  /** The 6px marker dot. The reference caps only its newest group with one. */
  marker?: boolean;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "id" | "children">) {
  return (
    <article id={id} className="mk-entry scroll-mt-24" {...rest}>
      {/*
        .mk-entry-rule now carries `bottom: -9px` itself (styles.css), so the
        rule overshoots each group by the reference's own 9px and stays
        continuous down the whole stream.
      */}
      <span className="mk-entry-rule" aria-hidden />
      {marker ? <span className="mk-entry-marker" aria-hidden /> : null}
      {/*
        Stacked, the reference's rail is a single line: status and number sit
        side by side below 640 rather than one under the other. The 32px
        row-gap the grid supplies above 640 (.mk-entry is display:block below
        640, and a block has no row gap) is restored by .mk-entry-aside's own
        `padding-bottom: 32px` at <=640 in styles.css. Measured against the
        reference: its rail renders at entry-top+20, its title box 28px below
        the rail's rendered bottom.

        The breakpoints are written as 640/641 rather than Tailwind's `sm`
        because .mk-entry collapses at `max-width: 640px`, and `sm:` starts at
        640 - one viewport width where the two would disagree.
      */}
      <div className="mk-entry-aside relative top-5 flex flex-wrap items-baseline gap-x-3 self-start min-[641px]:sticky min-[641px]:top-24 min-[641px]:block">
        {note ? <p className="mk-label min-[641px]:mb-1">{note}</p> : null}
        {label ? <p className="mk-entry-date">{label}</p> : null}
        {meta ? (
          <p className="mk-mini font-mono tabular-nums min-[641px]:mt-1" aria-hidden>
            {meta}
          </p>
        ) : null}
      </div>
      <div className="mk-entry-body">{children}</div>
    </article>
  );
}

export function EntryTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mk-entry-title" data-featured="true">
      {children}
    </h2>
  );
}

export function EntryProse({
  children,
  tone,
  first,
  className,
}: {
  children: ReactNode;
  /** "strong" is the reference's <strong> tier; "quiet" is its tertiary text. */
  tone?: "strong" | "quiet";
  /** First paragraph under a title: 12px above instead of 20px. */
  first?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn("mk-prose", first ? "mt-3" : "mt-5", className)}
      style={tone === "strong" ? STRONG : tone === "quiet" ? QUIET : undefined}
    >
      {children}
    </p>
  );
}

/** A labelled group inside an entry body: the <strong> tier over a disc list. */
export function EntryGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-8">
      <p className="mk-prose" style={STRONG}>
        {title}
      </p>
      <EntryList items={items} />
    </div>
  );
}

export function EntryList({ items }: { items: string[] }) {
  return (
    <ul className="mk-prose mt-3 list-disc pl-6 marker:text-[var(--mk-fg-2)]">
      {items.map((item) => (
        <li key={item} className="mk-prose mt-2 first:mt-0">
          {item}
        </li>
      ))}
    </ul>
  );
}

/*
  The reference's in-entry media is a bare <figure> at the full 624px column
  width, margin-block 48px (32px at 390), holding an image at radius 8px - no
  plate, no bezel, no shadow, no background of its own. The stage visual keeps
  that: it is composed from the system's own card + hairline vocabulary, which
  already reads on the page ground, so wrapping it in a panel would both invent
  a surface the reference does not have and collapse #0f1011 cards onto a
  #101112 panel.
*/
export function EntryFigure({ children }: { children: ReactNode }) {
  return <figure className="my-8 min-[641px]:my-12">{children}</figure>;
}
