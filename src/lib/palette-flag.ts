/**
 * The Palette B visual trial (see src/styles.css, `html[data-palette="b"]`)
 * is a switchable layer, never the shipped default. It exists only for the
 * product owner to judge a proposal against real screens - doc 44 locks the
 * current warm paper/ink identity, and a new palette is explicitly excluded
 * from that lock.
 *
 * Activation is a `?palette=b` query param, persisted to localStorage so it
 * survives a reload without the param; `?palette=a` clears it. Nothing else
 * in the app reads or writes this - no server code, no other persistence.
 */

export const PALETTE_STORAGE_KEY = "enquiry.palette";
export const PALETTE_QUERY_KEY = "palette";

export type PaletteStoreAction = "set" | "remove" | "none";

export type PaletteResolution = {
  /** What to do to localStorage this pass. */
  storeAction: PaletteStoreAction;
  /** The value localStorage should hold afterwards (null = removed). */
  stored: "b" | null;
  /** The `data-palette` attribute value to apply (null = remove the attribute). */
  attribute: "b" | null;
};

/**
 * Pure decision logic - no DOM, so it is trivially testable. `?palette=b`
 * wins and is stored; `?palette=a` wins and clears storage; any other or
 * absent query value leaves the previously stored choice untouched.
 */
export function resolvePaletteAction(
  searchString: string,
  storedValue: string | null,
): PaletteResolution {
  const requested = new URLSearchParams(searchString).get(PALETTE_QUERY_KEY);
  const nextStored: "b" | null =
    requested === "b" ? "b" : requested === "a" ? null : storedValue === "b" ? "b" : null;
  const storeAction: PaletteStoreAction =
    nextStored === (storedValue === "b" ? "b" : null)
      ? "none"
      : nextStored === "b"
        ? "set"
        : "remove";
  return { storeAction, stored: nextStored, attribute: nextStored };
}

/**
 * Applies the resolved palette to the live document. Wrapped in try/catch:
 * localStorage can throw in private-mode/locked-down browsers, and the
 * default palette (A) must stand if it does.
 */
export function syncPaletteFromLocation(): void {
  if (typeof window === "undefined") return;
  try {
    const stored = window.localStorage.getItem(PALETTE_STORAGE_KEY);
    const result = resolvePaletteAction(window.location.search, stored);
    if (result.storeAction === "set") window.localStorage.setItem(PALETTE_STORAGE_KEY, "b");
    if (result.storeAction === "remove") window.localStorage.removeItem(PALETTE_STORAGE_KEY);
    if (result.attribute === "b") {
      document.documentElement.setAttribute("data-palette", "b");
    } else {
      document.documentElement.removeAttribute("data-palette");
    }
  } catch {
    // localStorage/DOM unavailable - default palette (A) stands.
  }
}

/**
 * Inlined verbatim into the document <head> (src/routes/__root.tsx) so it
 * runs synchronously before first paint - the only way to apply the flag
 * without a flash of the wrong palette. It cannot import
 * syncPaletteFromLocation because it runs before any bundle is parsed, so
 * keep this in sync with resolvePaletteAction's logic by hand; the two are
 * covered by the same test file (palette-flag.test.ts) to catch drift.
 */
export const PALETTE_INLINE_SCRIPT = `(function(){try{var p=new URLSearchParams(location.search).get("${PALETTE_QUERY_KEY}");if(p==="b"){localStorage.setItem("${PALETTE_STORAGE_KEY}","b");}else if(p==="a"){localStorage.removeItem("${PALETTE_STORAGE_KEY}");}if(localStorage.getItem("${PALETTE_STORAGE_KEY}")==="b"){document.documentElement.setAttribute("data-palette","b");}}catch(e){}})();`;
