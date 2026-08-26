import { cn } from "@/lib/utils";
import type { CommercialValue } from "@/domain/labels";

export function CommercialValueMark({
  value,
  size = "md",
  className,
}: {
  value: CommercialValue;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  if (value.kind === "not_applicable") return null;

  const notReady = value.kind === "not_ready";

  if (size === "sm") {
    return (
      <p className={cn("flex min-w-0 items-baseline gap-1.5", className)}>
        {notReady ? (
          <span className="text-xs text-stone">Price not ready</span>
        ) : (
          <>
            <span
              className={cn(
                "font-serif text-sm tabular-nums font-medium text-ink",
                value.kind === "exact" && "commercial-exact",
                value.kind === "estimate" && "commercial-estimate",
              )}
            >
              {value.amountLabel}
            </span>
            {value.kind === "estimate" ? (
              <span className="text-2xs font-semibold uppercase tracking-wider text-stone">Est.</span>
            ) : null}
          </>
        )}
      </p>
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      <p
        className={cn(
          "min-w-0 tracking-tight",
          notReady ? "font-medium text-ink-2" : "font-serif tabular-nums text-ink",
          size === "lg" && (notReady ? "text-2xl" : "text-3xl"),
          size === "md" && (notReady ? "text-lg" : "text-2xl"),
          value.kind === "exact" && "commercial-exact",
          value.kind === "estimate" && "commercial-estimate",
        )}
      >
        {value.amountLabel}
      </p>
      <p className="mt-1.5 flex flex-wrap items-center gap-2">
        {value.kind === "not_ready" ? (
          <span className="text-xs leading-snug text-stone">{value.caption}</span>
        ) : (
          <KindMark kind={value.kind} caption={value.caption} />
        )}
      </p>
    </div>
  );
}

function KindMark({ kind, caption }: { kind: Exclude<CommercialValue["kind"], "not_ready" | "not_applicable">; caption: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider",
        kind === "exact" && "text-mark",
        kind === "estimate" && "text-ink-2",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-[1px]",
          kind === "exact" && "bg-mark",
          kind === "estimate" && "border border-ink",
        )}
      />
      {caption}
    </span>
  );
}
