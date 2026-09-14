import { createFileRoute } from "@tanstack/react-router";
import { TodayPage } from "@/components/enquiry/today-page";

export const Route = createFileRoute("/_app/today")({
  component: TodayPage,
});
