import { cn } from "@/lib/utils";

export function Wordmark({
  size = "md",
  inverse,
}: {
  size?: "sm" | "md";
  inverse?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={cn(
          "grid place-items-center rounded-md",
          size === "sm" ? "size-7" : "size-8",
          inverse ? "bg-sidebar-fg text-ink" : "bg-mark text-mark-fg",
        )}
        aria-hidden
      >
        <svg viewBox="0 0 16 16" className={size === "sm" ? "size-3.5" : "size-4"} fill="currentColor">
          <path d="M3.2 2.2h9.6v2.05H5.45v2.15h6.55v2.05H5.45v2.35H13v2.05H3.2V2.2z" />
        </svg>
      </span>
      <span
        className={cn(
          "font-serif font-medium tracking-tight",
          size === "sm" ? "text-lg" : "text-xl",
          inverse ? "text-sidebar-fg" : "text-ink",
        )}
      >
        Enquiry
      </span>
    </span>
  );
}
