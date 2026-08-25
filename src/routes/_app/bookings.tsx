import { createFileRoute } from "@tanstack/react-router";
import { BookingsCalendar } from "@/components/bookings/bookings-calendar";
import { useNarrow } from "@/lib/use-narrow";

type BookingsSearch = {
  on?: string;
  job?: string;
};

export const Route = createFileRoute("/_app/bookings")({
  component: BookingsPage,
  validateSearch: (search: Record<string, unknown>): BookingsSearch => ({
    on: typeof search.on === "string" ? search.on : undefined,
    job: typeof search.job === "string" ? search.job : undefined,
  }),
  head: () => ({ meta: [{ title: "Booked · Enquiry" }] }),
});

function BookingsPage() {
  const phone = useNarrow(860) ?? true;
  const search = Route.useSearch();
  return (
    <div className="h-full overflow-y-auto">
      <BookingsCalendar phone={phone} initialDay={search.on} initialJob={search.job} />
    </div>
  );
}
