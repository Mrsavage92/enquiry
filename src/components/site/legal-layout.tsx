import type { ReactNode } from "react";
import { SiteShell } from "./site-shell";

export function LegalLayout({
  title,
  sections,
  children,
}: {
  title: string;
  sections: readonly { id: string; title: string }[];
  children: ReactNode;
}) {
  return (
    <SiteShell>
      <article className="public-container public-legal">
        <header className="public-legal-header">
          <h1>{title}</h1>
          <p>Last updated 16 September 2026</p>
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
