import { createFileRoute } from "@tanstack/react-router";
import { EnquiriesListPage } from "@/components/enquiry/enquiries-list-page";

export const Route = createFileRoute("/_app/enquiries/")({
  component: EnquiriesListPage,
});
