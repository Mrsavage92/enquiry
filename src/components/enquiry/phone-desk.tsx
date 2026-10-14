import { useNavigate } from "@tanstack/react-router";
import { nextNeedsYou } from "@/domain/labels";
import type { Enquiry } from "@/domain/types";
import { usePrototype } from "@/store/prototype-store";
import { useEmbedNav } from "@/lib/use-embed-nav";
import { TeachDialog } from "./teach-dialog";
import { LaserDesk } from "./laser/laser-desk";

/**
 * One enquiry on the phone: the laser screen in the page's one scroller, its
 * summary sticky at the top and its action bar sticky at the bottom (doc 50).
 */
export function PhoneDesk({ enquiry }: { enquiry: Enquiry }) {
  const navigate = useNavigate();
  const embedNav = useEmbedNav();

  const advance = () => {
    const { enquiries, businessFilter } = usePrototype.getState();
    const next = nextNeedsYou(enquiries, businessFilter, enquiry.id);
    if (embedNav) {
      if (next) embedNav.open(next);
      else embedNav.today();
      return;
    }
    if (next) void navigate({ to: "/enquiries/$enquiryId", params: { enquiryId: next } });
    else void navigate({ to: "/today" });
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-raised">
      <div className="phone-conversation-scroll laser-scroll">
        <LaserDesk enquiry={enquiry} compact onDone={advance} />
      </div>
      <TeachDialog />
    </div>
  );
}
