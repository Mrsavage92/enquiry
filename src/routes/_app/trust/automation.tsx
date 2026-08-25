import { createFileRoute } from "@tanstack/react-router";
import { TrustAutomation } from "@/components/trust/trust-screen";

export const Route = createFileRoute("/_app/trust/automation")({
  component: TrustAutomation,
});
