import { cn } from "@/lib/utils";
import { useRef } from "react";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  fullWidth,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string; count?: number }[];
  ariaLabel: string;
  fullWidth?: boolean;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex w-max min-w-full flex-nowrap gap-0.5 rounded-md bg-paper-2 p-1",
        fullWidth && "w-full",
      )}
    >
      {options.map((option, index) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            onKeyDown={(event) => {
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? options.length - 1
                    : event.key === "ArrowRight"
                      ? (index + 1) % options.length
                      : event.key === "ArrowLeft"
                        ? (index - 1 + options.length) % options.length
                        : null;
              if (next === null) return;
              event.preventDefault();
              onChange(options[next]!.id);
              buttons.current[next]?.focus();
            }}
            onClick={() => onChange(option.id)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,color,box-shadow] duration-150 ease-out",
              fullWidth ? "min-w-0 flex-1 px-2" : "px-3",
              selected ? "bg-[#e9e2f8] text-mark-strong" : "text-ink-2 hover:text-ink",
            )}
          >
            {option.label}
            {option.count != null ? (
              <span
                className={cn(
                  "ml-1.5 tabular-nums",
                  selected ? "text-mark-strong" : "text-stone-on-paper-2",
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
