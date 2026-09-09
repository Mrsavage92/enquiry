import { FlaskConical } from "lucide-react";
import { usePrototype } from "@/store/prototype-store";

/**
 * The one honest, persistent signal that this workspace is fixture data, not
 * a real business's own enquiries. `demoMode` defaults to true for every
 * unauthenticated visitor, including anyone who arrives via "Open the app"
 * from the marketing site - and until this banner existed, nothing on
 * `/enquiries` said so (names, phone numbers and dollar totals were shown as
 * though they belonged to the viewer). Sits above the narrow/wide layout
 * split in AppShell, in the same non-scrolling chrome row as SystemBanners,
 * so it is visible on every route without colliding with the pinned action
 * bar (bottom of the desktop case file) or the phone queue's filter strip
 * (inside the scrollable content below).
 */
export function SampleWorkspaceBanner() {
  const demoMode = usePrototype((s) => s.demoMode);
  if (!demoMode) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 bg-sidebar px-4 py-2 text-xs text-sidebar-fg"
      role="status"
    >
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      Sample workspace - not your data.
    </div>
  );
}
