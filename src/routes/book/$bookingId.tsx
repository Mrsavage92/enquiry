import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";
import { formatAud } from "@/domain/labels";
import { BUSINESS_BY_ID, ENQUIRY_BY_ID } from "@/fixtures";
import { usePrototype } from "@/store/prototype-store";
import { fixtureLinksAllowed } from "@/lib/public-links";
import { authEnabled } from "@/lib/auth/client";
import { QuoteSheet, quoteSheets } from "@/components/enquiry/quote-sheet";

export const Route = createFileRoute("/book/$bookingId")({
  component: CustomerBook,
});

/**
 * R1D containment. These links are keyed by a short internal id that ships in
 * the client bundle, so they resolve only in an explicitly opted-in local
 * prototype build. Anything that can authenticate a user fails closed here
 * instead of serving one customer's record to whoever guesses the next id.
 */
const FIXTURE_LINKS_OK = fixtureLinksAllowed({
  optedIn: import.meta.env.VITE_FIXTURE_PUBLIC_LINKS === "true",
  authEnabled,
});

function LinkUnavailable() {
  return (
    <main className="mx-auto max-w-lg px-5 py-16">
      <Link to="/" className="mb-10 inline-block">
        <Wordmark />
      </Link>
      <p className="text-lg font-semibold tracking-tight">This link isn’t available</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Shareable customer links are not switched on for this deployment. If you were
        expecting a quote or a booking, reply to the message the business sent you and
        they’ll sort it out.
      </p>
      <Button asChild variant="secondary" className="mt-6">
        <Link to="/">Go to Enquiry</Link>
      </Button>
    </main>
  );
}

function CustomerBook() {
  if (!FIXTURE_LINKS_OK) return <LinkUnavailable />;
  const { bookingId } = Route.useParams();
  const storeBookings = usePrototype((s) => s.bookings);
  const storeEnquiries = usePrototype((s) => s.enquiries);
  const businesses = usePrototype((s) => s.businesses);
  const booking = storeBookings.find((b) => b.id === bookingId);
  const recordDeposit = usePrototype((s) => s.recordDeposit);
  const confirm = usePrototype((s) => s.confirmExternalBooking);
  const [step, setStep] = useState<"offer" | "terms" | "pay" | "done">("offer");
  if (!booking) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16">
        <p className="text-lg font-semibold tracking-tight">This booking isn’t here</p>
        <p className="mt-2 text-sm text-ink-2">It may have been reset with the prototype.</p>
        <Button asChild variant="secondary" className="mt-6">
          <Link to="/">Home</Link>
        </Button>
      </main>
    );
  }
  const business =
    businesses.find((b) => b.id === booking.businessId) ?? BUSINESS_BY_ID[booking.businessId];
  const enquiry =
    storeEnquiries.find((e) => e.id === booking.enquiryId) ?? ENQUIRY_BY_ID[booking.enquiryId];
  const quote = enquiry ? quoteSheets(enquiry).at(-1) : undefined;

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-paper px-5 pt-[max(2.5rem,var(--app-safe-top))] pb-[max(2.5rem,var(--app-safe-bottom))]">
      <p className="text-xl font-semibold tracking-tight">{business?.name}</p>
      <p className="mt-1 text-sm text-stone">Booking · no account required</p>
      <span className="page-rule" aria-hidden />
      {step === "offer" ? (
        <section className="mt-8">
          <h1 className="text-3xl font-semibold tracking-tight">{booking.serviceLabel}</h1>
          <p className="mt-2 text-sm text-ink-2">{booking.customerName}</p>
          {enquiry && quote && business ? (
            <div className="mt-6">
              <QuoteSheet quote={quote} enquiry={enquiry} business={business} />
            </div>
          ) : booking.value ? (
            <p className="mt-5 font-serif text-4xl tabular-nums tracking-tight">
              {formatAud(booking.value.amount)}
            </p>
          ) : null}
          <p className="mt-4 text-sm text-ink-2">Start {booking.when.replace("T", " · ").slice(0, 22)}</p>
          <Button className="mt-8 w-full min-h-11" onClick={() => setStep("terms")}>
            Continue
          </Button>
        </section>
      ) : null}
      {step === "terms" ? (
        <section className="mt-8">
          <h1 className="text-2xl font-semibold tracking-tight">Terms</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            30% commencement fee holds the start date. The balance is invoiced at delivery. Cancellation inside 14 days
            of start is at the studio’s discretion.
          </p>
          <Button className="mt-8 w-full min-h-11" onClick={() => setStep("pay")}>
            Accept and pay commencement fee
          </Button>
        </section>
      ) : null}
      {step === "pay" ? (
        <section className="mt-8">
          <h1 className="text-2xl font-semibold tracking-tight">Commencement fee</h1>
          <p className="mt-3 font-serif text-3xl tabular-nums tracking-tight">
            {booking.value ? formatAud(Math.round(booking.value.amount * 0.3)) : ""}
          </p>
          <p className="mt-2 text-sm text-stone">Simulated hosted payment. No card is collected in this prototype.</p>
          <Button
            className="mt-8 w-full min-h-11"
            onClick={() => {
              recordDeposit(booking.id);
              confirm(booking.enquiryId);
              setStep("done");
            }}
          >
            Pay (simulated)
          </Button>
        </section>
      ) : null}
      {step === "done" ? (
        <section className="mt-8">
          <h1 className="text-2xl font-semibold tracking-tight">Booked</h1>
          <p className="mt-3 text-sm leading-relaxed">
            The commencement fee is recorded. {business?.ownerFirstName} will write with the first workshop time.
          </p>
          <Button asChild variant="secondary" className="mt-8 w-full">
            <Link to="/">Home</Link>
          </Button>
        </section>
      ) : null}
      <p className="mt-16 flex justify-center opacity-60">
        <Wordmark size="sm" />
      </p>
    </main>
  );
}
