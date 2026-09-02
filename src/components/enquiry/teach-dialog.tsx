import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SheetContent } from "@/components/ui/sheet";
import { useNarrow } from "@/lib/use-narrow";
import { usePrototype } from "@/store/prototype-store";
import { BUSINESS_BY_ID } from "@/fixtures";
import { resolveBusiness } from "@/lib/workspace/resolve-business";

export function TeachDialog() {
  const teach = usePrototype((s) => s.teach);
  const businesses = usePrototype((s) => s.businesses);
  const demoMode = usePrototype((s) => s.demoMode);
  const decideTeach = usePrototype((s) => s.decideTeach);
  const setBrainTab = usePrototype((s) => s.setBrainTab);
  const enquiries = usePrototype((s) => s.enquiries);
  const navigate = useNavigate();
  const phone = useNarrow(860);
  const enquiry = enquiries.find((e) => e.id === teach?.enquiryId);
  const business =
    resolveBusiness(businesses, enquiry?.businessId, { demoMode, fixtures: BUSINESS_BY_ID });
  const Panel = phone ? SheetContent : DialogContent;

  return (
    <Dialog open={Boolean(teach)} onOpenChange={(o) => !o && decideTeach("enquiry")}>
      <Panel title="Is this just for this enquiry?">
        <p className="text-sm leading-relaxed text-ink-2">{teach?.proposal}</p>
        {phone ? null : (
        <p className="mt-3 text-sm text-ink-2">
          Customer-specific facts stay here. If this is how {business?.name ?? "the business"} works, you can teach Enquiry.
        </p>
        )}
        <div className="mt-5 flex flex-col gap-2">
          <Button
            variant="secondary"
            className="min-h-12 w-full"
            onClick={() => {
              decideTeach("enquiry");
              toast("Kept on this enquiry only");
            }}
          >
            Just this enquiry
          </Button>
          <Button
            className="min-h-12 w-full"
            onClick={() => {
              const name = business?.name ?? "Business Brain";
              decideTeach("teach");
              setBrainTab("learning");
              toast(`Proposed for ${name}. Confirm it if this should apply next time.`);
              void navigate({ to: "/business" });
            }}
          >
            Teach Enquiry
          </Button>
        </div>
        {phone ? null : (
        <p className="mt-3 text-xs text-stone">
          Teaching proposes a learning item. High-impact prices still need confirmation before they become Active.
        </p>
        )}
      </Panel>
    </Dialog>
  );
}
