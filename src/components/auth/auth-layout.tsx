import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/ui/wordmark";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-surface">
        <header className="auth-header">
          <Link to="/" aria-label="Enquiry home" className="auth-brand">
            <Wordmark />
          </Link>
        </header>
        <div className="auth-content">{children}</div>
        <footer className="auth-footer">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </footer>
      </div>
      <div className="auth-artwork" aria-hidden="true">
        <img src="/images/auth/enquiry-envelope.png" alt="" width="1086" height="1448" />
      </div>
    </main>
  );
}
