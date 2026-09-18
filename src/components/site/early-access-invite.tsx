import { WaitlistForm } from "@/components/site/waitlist-form";

export function EarlyAccessInvite() {
  return (
    <section className="public-invite" aria-labelledby="invite-title">
      <div className="public-container">
        <div>
          <p className="public-kicker">Help shape what comes next</p>
          <h2 id="invite-title">Enquiry, for your working day.</h2>
          <p>
            Join the list. We will invite businesses in small groups as early access opens.
            Indicative pricing is from A$29 per month inc GST, with 30% off the first 12 months
            for founding members.
          </p>
        </div>
        <div className="public-invite-action">
          <WaitlistForm compact />
          <p>No payment to join the list.</p>
        </div>
      </div>
    </section>
  );
}
