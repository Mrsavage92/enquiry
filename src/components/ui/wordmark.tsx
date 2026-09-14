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
          "inline-flex items-center justify-center rounded-full",
          size === "sm" ? "size-2.5" : "size-3",
          inverse ? "bg-mark" : "bg-mark",
        )}
        aria-hidden
      />
      <span
        className={cn(
          "font-sans font-semibold tracking-normal",
          size === "sm" ? "text-lg" : "text-xl",
          inverse ? "text-sidebar-fg" : "text-ink",
        )}
      >
        Enquiry
      </span>
    </span>
  );
}
