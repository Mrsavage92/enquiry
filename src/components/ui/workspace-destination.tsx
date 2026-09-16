import { Link } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";

export function WorkspaceDestination({
  to,
  icon: Icon,
  title,
  description,
}: {
  to:
    | "/settings"
    | "/business"
    | "/trust"
    | "/trust/access"
    | "/trust/audit"
    | "/usage"
    | "/account"
    | "/support"
    | "/roadmap"
    | "/today";
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link to={to} className="workspace-destination">
      <span className="workspace-destination-icon">
        <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <ChevronRight size={17} aria-hidden="true" />
    </Link>
  );
}
