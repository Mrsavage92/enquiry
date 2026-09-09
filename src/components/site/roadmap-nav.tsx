import { ROADMAP_ACCESS, ROADMAP_PHASE, ROADMAP_WRITTEN, STAGES } from "@/lib/launch/roadmap";

/*
  The reference's own page navigation, re-measured from
  https://linear.app/changelog on 2026-09-09.

  The changelog carries TWO orientation mechanisms and neither is a sticky bar:

    1. A static tab row under the h1 - .tabRow is `display:flex;
       justify-content:space-between; align-items:center`, 40px tall on the
       1280px column at y=210, i.e. 12px under the h1's baseline box. Its left
       slot is a 16px gap-16 row of tabs (#8a8f98, #f7f8f8 when current, no
       underline, no padding, no pill, `transition: color .1s`); its right slot
       holds the page's utility - a search field there, the roadmap's "last
       updated" line here.
    2. A per-group label column that is `position: sticky; top: 96px`, so the
       label you are inside stays beside you the whole way down the group.

  So the sticky era bar this route used to carry is replaced, not kept: the
  jump-to-stage function moves into the reference's tab row and the
  "where am I" function moves onto the sticky rail label (roadmap-entry.tsx).
  The decision is the extraction's, not a preference - `sticky_or_fixed` on the
  reference returns the date columns and nothing else.

  The divider under it is the reference's: 1px #18191a, radius 9999px,
  margin 32px 0 64px, full column width.
*/

export function RoadmapEraNav({
  active,
  onJump,
}: {
  active: string;
  onJump: (id: string) => void;
}) {
  return (
    <div className="mk-container">
      <nav
        aria-label="Roadmap stages"
        className="flex flex-col gap-3 lg:h-10 lg:flex-row lg:items-center lg:justify-between lg:gap-8"
      >
        <div className="-mx-1 flex gap-4 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STAGES.map((stage) => (
            <button
              key={stage.id}
              type="button"
              className="mk-tab shrink-0"
              data-active={active === stage.id ? "true" : undefined}
              aria-current={active === stage.id ? "true" : undefined}
              onClick={() => onJump(stage.id)}
            >
              {stage.short}
            </button>
          ))}
        </div>
        <p className="mk-mini shrink-0">
          Last updated {ROADMAP_WRITTEN}
          <Separator />
          {ROADMAP_PHASE}
          <Separator />
          {ROADMAP_ACCESS}
        </p>
      </nav>
      <div className="mk-divider mt-8 mb-16" data-divider="header" />
    </div>
  );
}

/*
  This separator used to be painted with `text-line-strong` - a hairline BORDER
  token used as a text colour - and measured 1.19:1 and 1.25:1 in the rendered
  sweep (system.md section 8). It is painted in --mk-fg-2 (#d0d6e0) rather than
  the line's own --mk-fg-3 because a 13px "·" loses most of its glyph area to
  antialiasing and never reaches its specified colour; the same fix was needed
  on the decision demo's separator.
*/
function Separator() {
  return (
    <span aria-hidden className="mx-2" style={{ color: "var(--mk-fg-2)" }}>
      ·
    </span>
  );
}
