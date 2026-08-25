import { createFileRoute } from "@tanstack/react-router";
import { BrainScreen } from "@/components/business/brain-screen";

export const Route = createFileRoute("/_app/business")({
  component: BrainScreen,
});
