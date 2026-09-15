import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";
import { Compass } from "lucide-react";

export function NotFound() {
  return (
    <div className="customer-link-page">
      <header>
        <Link to="/" aria-label="Enquiry home">
          <Wordmark />
        </Link>
      </header>
      <main className="customer-link-state">
        <span className="account-feature-icon">
          <Compass size={28} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <h1 className="mt-10 text-3xl font-semibold tracking-tight">That page isn’t here</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          This address may have changed, or the link may be incomplete. Your workspace and the
          Enquiry website are still here.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/">Home</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/early-access">Early access</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/enquiries">Open the app</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
