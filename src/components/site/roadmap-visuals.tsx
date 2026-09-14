import {
  Bell,
  BookOpenCheck,
  CalendarCheck2,
  Check,
  CircleCheck,
  Clock3,
  Focus,
  GitBranch,
  ListChecks,
  MessageCircle,
  MoveRight,
  Reply,
  Settings2,
  ShieldCheck,
  Smartphone,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  now: Check,
  next: Clock3,
  later: MoveRight,
  exploring: Focus,
  understand: MessageCircle,
  "business-brain": Reply,
  "clear-outcomes": CalendarCheck2,
  continuity: GitBranch,
  "native-apps": Smartphone,
  "catch-up": Bell,
  "keep-moving": ListChecks,
  "booking-path": CircleCheck,
  "trusted-action": ShieldCheck,
  "busy-mode": Focus,
  "teach-by-correction": BookOpenCheck,
  endgame: MoveRight,
};

export function RoadmapIcon({ id }: { id: string }) {
  const Icon = ICONS[id] ?? Settings2;
  return <Icon aria-hidden="true" size={22} strokeWidth={1.7} />;
}

export function PocketConcept() {
  return (
    <figure className="roadmap-pocket">
      <img
        src="/product/roadmap/native-apps-concept.webp"
        alt="Concept illustration of two phones, representing planned iPhone and Android apps."
        width={600}
        height={400}
        loading="lazy"
      />
      <figcaption>Planned concept · Not yet available</figcaption>
    </figure>
  );
}
