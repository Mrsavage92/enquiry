import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";

/** Delete the practice enquiry, then go back to Today. */
export function useDeletePractice() {
  const actions = useFirstBetaActions();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const remove = async (enquiryId: string) => {
    setDeleting(true);
    try {
      const res = await actions.deletePractice(enquiryId);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast("Practice enquiry deleted.");
      void navigate({ to: "/today" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the practice enquiry.");
    } finally {
      setDeleting(false);
    }
  };
  return { remove, deleting };
}
