import { createFileRoute } from "@tanstack/react-router";
import { EnquiryWorkspace } from "@/components/enquiry/workspace";

export const Route = createFileRoute("/_app/enquiries/")({
  component: () => <EnquiryWorkspace />,
});
