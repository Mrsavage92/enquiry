import { OFFER, paymentsOpen } from "@/lib/site/offer";
import { WaitlistForm } from "@/components/site/waitlist-form";

export function EarlyAccessInvite() {
  return (
    <section className="public-invite" aria-labelledby="invite-title">
      <div className="public-container">
        <div>
          <p className="public-kicker">Help shape what comes next</p>
          <h2 id="invite-title">Stop guessing at the reply.</h2>
          <p>
            {OFFER.short} {OFFER.start}
          </p>
        </div>
        <div className="public-invite-action">
          <WaitlistForm compact />
          <p>{paymentsOpen ? OFFER.refund : "No payment to join the list."}</p>
        </div>
      </div>
    </section>
  );
}
