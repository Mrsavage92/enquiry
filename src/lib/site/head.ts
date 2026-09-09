/**
 * Production origin this deployment owns. Checked in order:
 * `VITE_PUBLIC_SITE_HOST` (the bare host scripts/grok-pwa-shared.mjs already
 * resolves og:image against on Vercel), then `VITE_PUBLIC_APP_ORIGIN` (the
 * full origin auth already owns - see lib/auth/origin.ts), then this
 * hardcoded default. A head() must never throw, so an unconfigured dev
 * server still gets a real, crawlable absolute URL instead of one built
 * from localhost - unlike auth's origin resolver, this one never fails
 * closed.
 */
const SITE_ORIGIN_DEFAULT = "https://enquiry-ashy.vercel.app";

/** The shared 1200x630 share card - one asset, every route. */
const SHARE_IMAGE_PATH = "/og.jpg";

/**
 * Mirrors `src/lib/og/site.json`'s `imageAlt` - the text the platform's own
 * OG middleware (scripts/grok-pwa-shared.mjs) emits for this same card.
 * Duplicated as a plain string rather than imported: site.json is read by
 * Node build scripts via `readFileSync`, not bundled as app JSON, and the
 * one shared card is used by every route, so this alt text does not vary
 * per route either.
 */
const SHARE_IMAGE_ALT =
  "Enquiry's decision panel for a real enquiry: interior painting, 4 bedrooms plus living, New Farm. Next action: offer a site measure.";

function parseOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
}

export function siteOrigin(): string {
  const host = String(import.meta.env.VITE_PUBLIC_SITE_HOST ?? "");
  const origin = String(import.meta.env.VITE_PUBLIC_APP_ORIGIN ?? "");
  return parseOrigin(host) ?? parseOrigin(origin) ?? SITE_ORIGIN_DEFAULT;
}

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${siteOrigin()}${normalized}`;
}

export type SocialHeadInput = {
  /** Route path, e.g. "/", "/how". Used for canonical + og:url. */
  path: string;
  title: string;
  description: string;
};

/**
 * Matches the meta-tag shapes every route already used before this helper
 * existed (`{ title }`, `{ name, content }`, `{ property, content }`) - the
 * router's `head()` option types `meta` as `React.JSX.IntrinsicElements['meta']`,
 * not the router-core `MetaDescriptor` union, so this stays a plain subset of
 * that rather than importing a type the framework does not actually expect here.
 */
type MetaTag =
  { title: string } | { name: string; content: string } | { property: string; content: string };

export type SocialHead = {
  meta: MetaTag[];
  links: { rel: string; href: string }[];
};

/**
 * The full social-share head for one marketing route: title, description,
 * canonical, and the OG/Twitter card set, all resolved to absolute URLs at
 * the source. This is what makes dev, SSR and production agree - the
 * document already carries a correct, complete card before any middleware
 * runs, and scripts/grok-pwa-shared.mjs now trusts a route that has done
 * this (see `hasOwnShareCard` there) instead of overwriting it.
 */
export function socialHead({ path, title, description }: SocialHeadInput): SocialHead {
  const url = absoluteUrl(path);
  const image = absoluteUrl(SHARE_IMAGE_PATH);
  const meta: MetaTag[] = [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: url },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: SHARE_IMAGE_ALT },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
  ];
  return {
    meta,
    links: [{ rel: "canonical", href: url }],
  };
}
