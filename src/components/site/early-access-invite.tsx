import { OFFER, paymentsOpen } from "@/lib/site/offer";
import { WaitlistForm } from "@/components/site/waitlist-form";

/**
 * `reassure` is off on home, where the hero note already carries the payment
 * sentence; pages without the hero keep it under the form.
 */
export function EarlyAccessInvite({ reassure = true }: { reassure?: boolean }) {
  return (
    <section className="public-invite" aria-labelledby="invite-title">
      <div className="public-container">
        <div>
          <p className="public-kicker">Founding price</p>
          <h2 id="invite-title">Stop guessing at the reply.</h2>
          <p>{OFFER.band}</p>
        </div>
        <div className="public-invite-action">
          <WaitlistForm compact />
          {reassure ? <p>{paymentsOpen ? OFFER.refund : OFFER.reassure}</p> : null}
        </div>
      </div>
    </section>
  );
}
