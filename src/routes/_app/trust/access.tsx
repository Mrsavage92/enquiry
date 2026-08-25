import { createFileRoute } from "@tanstack/react-router";
import { TrustAccess } from "@/components/trust/trust-screen";

export const Route = createFileRoute("/_app/trust/access")({
  component: TrustAccess,
});
