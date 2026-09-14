import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/ui/wordmark";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <header className="auth-header">
        <Link to="/" aria-label="Enquiry home" className="auth-brand">
          <Wordmark />
        </Link>
        <Link to="/" className="auth-back">
          <ArrowLeft size={15} aria-hidden="true" />
          Back to website
        </Link>
      </header>
      <main className="auth-stage">
        <div className="auth-content">{children}</div>
      </main>
      <footer className="auth-footer">
        <span>Enquiry</span>
        <nav aria-label="Legal">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </nav>
      </footer>
    </div>
  );
}
