import { createFileRoute } from "@tanstack/react-router";
import { BrainScreen } from "@/components/business/brain-screen";

/**
 * `?section=pricing` opens straight onto the prices, so "Add your prices" on an
 * enquiry lands where the owner can add one, not on a menu. `service` names the
 * thing a customer asked for that has no price yet ("Add a price for oven
 * cleaning"), so the box starts with its name.
 */
type BusinessSearch = { section?: "pricing"; service?: string };

export const Route = createFileRoute("/_app/business")({
  validateSearch: (search: Record<string, unknown>): BusinessSearch => {
    if (search.section !== "pricing") return {};
    const service =
      typeof search.service === "string" ? search.service.trim().slice(0, 80) : "";
    return service ? { section: "pricing", service } : { section: "pricing" };
  },
  component: BrainScreen,
});
