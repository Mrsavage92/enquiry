import { createFileRoute } from "@tanstack/react-router";
import { BrainScreen } from "@/components/business/brain-screen";

/**
 * `?section=pricing` opens straight onto the prices, so "Add your prices" on an
 * enquiry lands where the owner can add one, not on a menu.
 */
type BusinessSearch = { section?: "pricing" };

export const Route = createFileRoute("/_app/business")({
  validateSearch: (search: Record<string, unknown>): BusinessSearch =>
    search.section === "pricing" ? { section: "pricing" } : {},
  component: BrainScreen,
});
