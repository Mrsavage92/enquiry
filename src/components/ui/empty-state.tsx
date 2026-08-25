import type { ReactNode } from "react";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-t border-line py-12">
      <svg
        viewBox="0 0 72 48"
        className="h-10 w-auto text-line-strong"
        aria-hidden
      >
        <rect x="8" y="10" width="44" height="32" rx="2" fill="currentColor" opacity="0.35" />
        <rect x="16" y="6" width="44" height="32" rx="2" fill="currentColor" opacity="0.55" />
        <rect x="20" y="12" width="20" height="2" fill="var(--color-paper)" />
        <rect x="20" y="18" width="28" height="2" fill="var(--color-paper)" />
        <rect x="20" y="24" width="16" height="2" fill="var(--color-paper)" />
      </svg>
      <p className="mt-4 font-medium">{title}</p>
      <p className="mt-1 max-w-md text-sm leading-relaxed text-stone">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
