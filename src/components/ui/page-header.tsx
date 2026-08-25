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
          "text-2xl font-semibold tracking-tight text-ink sm:text-3xl",
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
