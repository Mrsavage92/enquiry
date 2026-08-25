import { createFileRoute } from "@tanstack/react-router";
import { EnquiryWorkspace } from "@/components/enquiry/workspace";

export const Route = createFileRoute("/_app/enquiries/$enquiryId")({
  component: EnquiryDetail,
});

function EnquiryDetail() {
  const { enquiryId } = Route.useParams();
  return <EnquiryWorkspace enquiryId={enquiryId} />;
}
