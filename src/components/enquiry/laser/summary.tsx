import { Link } from "@tanstack/react-router";
import { ChevronLeft, MoreHorizontal, PanelRightOpen } from "lucide-react";
import type { Enquiry } from "@/domain/types";
import { verdictLine } from "@/domain/laser-view";
import { leadDateCue } from "../card-cues";
import { PracticeBadge } from "../practice-note";
import { useEmbedNav } from "@/lib/use-embed-nav";

/**
 * Slot A: who, what, when and the verdict, said once (doc 50 sections 3 and
 * 5). Sticky at the top so the decision is on screen without scrolling; the
 * overflow button holds everything that is not the next tap.
 */
export function Summary({
  enquiry,
  compact,
  onMenu,
  asideOpen,
  onAside,
}: {
  enquiry: Enquiry;
  compact: boolean;
  onMenu: () => void;
  asideOpen?: boolean;
  onAside?: () => void;
}) {
  const embedNav = useEmbedNav();
  const verdict = verdictLine(enquiry);
  const line2 = [enquiry.serviceLabel, leadDateCue(enquiry)].filter(Boolean).join(" · ");
  return (
    <header className="laser-summary" data-compact={compact || undefined}>
      {embedNav ? (
        <button
          type="button"
          className="laser-icon-button"
          aria-label="Back to today"
          onClick={() => embedNav.today()}
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
      ) : (
        <Link to="/enquiries" className="laser-icon-button" aria-label="Back to enquiries">
          <ChevronLeft size={20} aria-hidden />
        </Link>
      )}
      <div className="laser-summary-text">
        <div className="laser-summary-name">
          <h1 data-count="customer">{enquiry.customerName}</h1>
          <PracticeBadge enquiry={enquiry} />
        </div>
        {line2 ? <p className="laser-summary-line">{line2}</p> : null}
        <p className="laser-verdict" data-tone={verdict.tone} id="laser-verdict">
          {verdict.line}
        </p>
      </div>
      {onAside ? (
        <button
          type="button"
          className="laser-icon-button"
          aria-label={asideOpen ? "Hide why and details" : "Show why and details"}
          aria-pressed={asideOpen}
          onClick={onAside}
        >
          <PanelRightOpen size={19} aria-hidden />
        </button>
      ) : null}
      <button type="button" className="laser-icon-button" aria-label="More" onClick={onMenu}>
        <MoreHorizontal size={20} aria-hidden />
      </button>
    </header>
  );
}
