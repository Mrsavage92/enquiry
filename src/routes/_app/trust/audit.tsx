import { createFileRoute } from "@tanstack/react-router";
import { TrustAudit } from "@/components/trust/trust-screen";

export const Route = createFileRoute("/_app/trust/audit")({
  component: TrustAudit,
});
