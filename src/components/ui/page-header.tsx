import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn(className)}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1
        className={cn(
          "text-[22px] font-semibold text-ink sm:text-[28px]",
          eyebrow && "mt-1.5",
        )}
      >
        {title}
      </h1>
      <span className="page-rule" aria-hidden />
      {description ? (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2">{description}</p>
      ) : null}
      {children}
    </header>
  );
}
