import { useNavigate } from "@tanstack/react-router";
import { briefing } from "@/domain/briefing";
import { usePrototype } from "@/store/prototype-store";

export function QueueBriefing() {
  const enquiries = usePrototype((s) => s.enquiries);
  const businesses = usePrototype((s) => s.businesses);
  const bookings = usePrototype((s) => s.bookings);
  const filter = usePrototype((s) => s.businessFilter);
  const setQueue = usePrototype((s) => s.setQueueFilter);
  const setBrainTab = usePrototype((s) => s.setBrainTab);
  const navigate = useNavigate();
  const b = briefing(enquiries, businesses, bookings, filter);
  const bits: { label: string; onClick: () => void }[] = [];
  if (b.followUp) {
    bits.push({
      label: `${b.followUp} follow-up${b.followUp === 1 ? "" : "s"}`,
      onClick: () => setQueue("at_risk"),
    });
  }
  if (b.calendarDown) {
    bits.push({
      label: `${b.calendarDown} calendar down`,
      onClick: () => setQueue("needs_you"),
    });
  }
  if (b.learning) {
    bits.push({
      label: `${b.learning} learning`,
      onClick: () => {
        setBrainTab("learning");
        void navigate({ to: "/business" });
      },
    });
  }
  if (bits.length === 0) return null;
  return (
    <p className="mt-2 text-xs leading-relaxed text-ink-2">
      This morning
      {bits.map((bit, i) => (
        <span key={bit.label}>
          {i === 0 ? " · " : " · "}
          <button
            type="button"
            className="font-medium text-ink underline-offset-4 hover:underline"
            onClick={bit.onClick}
          >
            {bit.label}
          </button>
        </span>
      ))}
    </p>
  );
}
