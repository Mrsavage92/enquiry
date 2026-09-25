import type { ReactNode } from "react";
import { SiteShell } from "./site-shell";

export function LegalLayout({
  title,
  lastUpdated,
  sections,
  children,
}: {
  title: string;
  /** e.g. "25 September 2026" - each page states its own, since they change on different days. */
  lastUpdated: string;
  sections: readonly { id: string; title: string }[];
  children: ReactNode;
}) {
  return (
    <SiteShell>
      <article className="public-container public-legal">
        <header className="public-legal-header">
          <h1>{title}</h1>
          <p>Last updated {lastUpdated}</p>
        </header>
        <div className="public-legal-grid">
          <nav aria-label={`${title} contents`}>
            <p>On this page</p>
            {sections.map((section) => (
              <a href={`#${section.id}`} key={section.id}>
                {section.title}
              </a>
            ))}
          </nav>
          <div className="public-legal-body">{children}</div>
        </div>
      </article>
    </SiteShell>
  );
}
