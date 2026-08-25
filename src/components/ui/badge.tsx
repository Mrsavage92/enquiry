import { cn } from "@/lib/utils";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "danger" | "info";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-sm px-1.5 py-0.5 text-2xs font-semibold tracking-wide",
        tone === "neutral" && "bg-paper-2 text-ink-2",
        tone === "ok" && "bg-ok-bg text-ok",
        tone === "warn" && "bg-warn-bg text-warn",
        tone === "danger" && "bg-danger-bg text-danger",
        tone === "info" && "bg-paper-2 text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}
