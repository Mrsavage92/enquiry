import { createFileRoute } from "@tanstack/react-router";
import { TrustOverview } from "@/components/trust/trust-screen";

export const Route = createFileRoute("/_app/trust/")({
  component: TrustOverview,
});
