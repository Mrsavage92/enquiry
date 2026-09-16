import { Link } from "@tanstack/react-router";
import { ArrowRight, Link2Off } from "lucide-react";
import { Wordmark } from "@/components/ui/wordmark";
import { Button } from "@/components/ui/button";

export function CustomerLinkUnavailable() {
  return (
    <div className="customer-link-page">
      <header>
        <Link to="/" aria-label="Enquiry home">
          <Wordmark />
        </Link>
      </header>
      <main className="customer-link-state">
        <span className="account-feature-icon">
          <Link2Off size={28} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <h1>This link isn't available</h1>
        <p>
          Shareable customer links are not switched on for this deployment. If you were expecting a
          quote or a booking, reply to the message the business sent you and they'll sort it out.
        </p>
        <Button asChild variant="secondary">
          <Link to="/">
            Go to Enquiry <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </Button>
      </main>
    </div>
  );
}
