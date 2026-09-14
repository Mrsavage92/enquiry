import { createFileRoute } from "@tanstack/react-router";
import { MorePage } from "@/components/shell/more-page";

export const Route = createFileRoute("/_app/more")({
  component: MorePage,
});
