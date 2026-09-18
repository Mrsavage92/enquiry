import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Pause, Play } from "lucide-react";
import { Wordmark } from "@/components/ui/wordmark";
import { AuroraBackground } from "@/components/ui/aurora-background";

export function AuthLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const [motionPaused, setMotionPaused] = useState(false);
  const motionLabel = motionPaused ? "Resume background animation" : "Pause background animation";

  return (
    <div className="auth-page" data-aurora-paused={motionPaused || undefined}>
      <AuroraBackground />
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
        <div className={`auth-content${wide ? " auth-content-wide" : ""}`}>{children}</div>
      </main>
      <footer className="auth-footer">
        <div className="auth-footer-brand">
          <span>Enquiry</span>
          <button
            type="button"
            className="auth-motion-toggle"
            aria-label={motionLabel}
            title={motionLabel}
            onClick={() => setMotionPaused((paused) => !paused)}
          >
            {motionPaused ? (
              <Play size={14} aria-hidden="true" />
            ) : (
              <Pause size={14} aria-hidden="true" />
            )}
            <span>{motionPaused ? "Resume motion" : "Pause motion"}</span>
          </button>
        </div>
        <nav aria-label="Legal">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </nav>
      </footer>
    </div>
  );
}
