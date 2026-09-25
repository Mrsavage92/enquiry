import { OFFER, paymentsOpen } from "@/lib/site/offer";
import { WaitlistForm } from "@/components/site/waitlist-form";

export function EarlyAccessInvite() {
  return (
    <section className="public-invite" aria-labelledby="invite-title">
      <div className="public-container">
        <div>
          <p className="public-kicker">Founding price</p>
          <h2 id="invite-title">Stop guessing at the reply.</h2>
          <p>
            {OFFER.short} {OFFER.start}
          </p>
        </div>
        <div className="public-invite-action">
          <WaitlistForm compact />
          <p>{paymentsOpen ? OFFER.refund : OFFER.reassure}</p>
        </div>
      </div>
    </section>
  );
}
