import { cn } from "@/lib/utils";

export function Wordmark({ size = "md", inverse }: { size?: "sm" | "md"; inverse?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-0.5">
      <span
        className={cn(
          "font-sans font-semibold tracking-normal",
          size === "sm" ? "text-lg" : "text-xl",
          inverse ? "text-sidebar-fg" : "text-ink",
        )}
      >
        Enquiry
      </span>
      <span className="text-mark text-2xl font-bold" aria-hidden>
        .
      </span>
    </span>
  );
}
