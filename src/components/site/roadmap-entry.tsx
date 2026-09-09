import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
  The changelog entry, re-measured from https://linear.app/changelog on
  2026-09-09 (raw values in .style-mirror/reextract/). One entry is one date
  group in the reference: a 12-column grid whose label column sits at 1/4
  against a 1px rule running the group's whole height, and whose body sits at
  4/10.

  The shared .mk-entry-* vocabulary in styles.css already carries the grid, the
  rule, the marker, the label type and the title tiers. The values below are the
  ones that vocabulary does not carry. They are set here rather than in
  styles.css because styles.css belongs to another builder this pass; each is a
  reference computed value, not a guess:

    rule       bottom: -9px - the reference's dateBar overshoots its group by
               the same 9px its top is inset, so the rule never breaks between
               groups.
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
  meta,
  marker,
  children,
  ...rest
}: {
  id?: string;
  /** The rail label. The reference puts the date here; the roadmap puts status. */
  label?: string;
  /** Second rail line - the stage number. The reference's rail carries one line. */
  meta?: string;
  /** The 6px marker dot. The reference caps only its newest group with one. */
  marker?: boolean;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "id" | "children">) {
  return (
    <article id={id} className="mk-entry scroll-mt-24" {...rest}>
      {/*
        The shared .mk-entry-rule stops at the group's own bottom edge and its
        top starts 9px in, so consecutive groups show a 9px break. The reference
        runs `top: 0 / margin-top: 9px / bottom: -9px`, overshooting by exactly
        that 9px so the rule is continuous down the whole stream. Only `bottom`
        differs, and it is set inline so the class still handles the <=640 hide.
      */}
      <span className="mk-entry-rule" style={{ bottom: "-9px" }} aria-hidden />
      {marker ? <span className="mk-entry-marker" aria-hidden /> : null}
      <div className="mk-entry-aside relative top-5 self-start sm:sticky sm:top-24">
        {label ? <p className="mk-entry-date">{label}</p> : null}
        {meta ? (
          <p className="mk-mini mt-1 font-mono tabular-nums" aria-hidden>
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
  return <figure className="my-8 sm:my-12">{children}</figure>;
}
