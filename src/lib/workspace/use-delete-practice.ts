import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import { usePrototype } from "@/store/prototype-store";

/**
 * Delete the practice enquiry, then go back to Today. Undo brings a practice
 * enquiry back straight away - a fresh one, and the toast says so, since the
 * steps taken on the deleted one are gone.
 */
export function useDeletePractice() {
  const actions = useFirstBetaActions();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const remove = async (enquiryId: string) => {
    const businessId = usePrototype
      .getState()
      .enquiries.find((e) => e.id === enquiryId)?.businessId;
    setDeleting(true);
    try {
      const res = await actions.deletePractice(enquiryId);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast(
        "Practice enquiry deleted.",
        businessId
          ? {
              action: {
                label: "Undo",
                onClick: () =>
                  void actions
                    .createPractice(businessId)
                    .then((id) => {
                      toast.success("Practice enquiry is back, from the start.");
                      void navigate({ to: "/enquiries/$enquiryId", params: { enquiryId: id } });
                    })
                    .catch((err: unknown) =>
                      toast.error(
                        err instanceof Error ? err.message : "Could not bring it back.",
                      ),
                    ),
              },
            }
          : undefined,
      );
      void navigate({ to: "/today" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the practice enquiry.");
    } finally {
      setDeleting(false);
    }
  };
  return { remove, deleting };
}
