import type { ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";

export function EmptyState({
  title,
  body,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="workspace-empty py-12 text-center">
      <span
        className="mx-auto grid size-12 place-items-center rounded-full bg-paper-2 text-mark"
        aria-hidden
      >
        <Icon size={24} strokeWidth={1.5} />
      </span>
      <p className="mt-4 font-medium">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-stone">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
