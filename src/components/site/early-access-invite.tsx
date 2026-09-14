import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export function EarlyAccessInvite() {
  return (
    <section className="public-invite" aria-labelledby="invite-title">
      <div className="public-container">
        <div>
          <p className="public-kicker">Help shape what comes next</p>
          <h2 id="invite-title">Enquiry, for your working day.</h2>
          <p>Join the list. We will invite businesses in small groups as early access opens.</p>
        </div>
        <div className="public-invite-action">
          <Link to="/early-access" className="public-button">
            Join early access <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <p>No payment to join the list.</p>
        </div>
      </div>
    </section>
  );
}
