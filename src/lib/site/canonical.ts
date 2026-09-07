/**
 * Single source of truth for the production origin used in canonical links.
 * Matches public/sitemap.xml and public/robots.txt, which are hand-written
 * static files and can't import this - keep them in sync by hand if this
 * origin ever changes.
 */
export const SITE_ORIGIN = "https://enquiry-ashy.vercel.app";

export function canonicalUrl(path: string): string {
  return `${SITE_ORIGIN}${path}`;
}

/** A ready-to-spread entry for a route's `head().links` array. */
export function canonicalLink(path: string) {
  return { rel: "canonical", href: canonicalUrl(path) };
}
