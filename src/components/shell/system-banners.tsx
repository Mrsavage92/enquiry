import { Pause, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrototype } from "@/store/prototype-store";
import { useNarrow } from "@/lib/use-narrow";

export function SystemBanners() {
  const offline = usePrototype((s) => s.offline);
  const businesses = usePrototype((s) => s.businesses);
  const filter = usePrototype((s) => s.businessFilter);
  const resume = usePrototype((s) => s.resume);
  const paused = businesses.filter((b) => b.paused);
  const scoped =
    filter === "all" ? paused : paused.filter((b) => b.id === filter);
  const phone = useNarrow(860) !== false;

  if (!offline && scoped.length === 0) return null;

  return (
    <div className="flex flex-col">
      {offline ? (
        <div
          className="flex items-center justify-center gap-2 bg-sidebar px-4 py-2.5 text-sm text-sidebar-fg"
          role="status"
        >
          <WifiOff className="size-3.5 shrink-0" aria-hidden />
          {phone ? "Offline. Nothing will send." : "You’re offline. Enquiry will keep working on this device. Nothing will send until you’re back."}
        </div>
      ) : null}
      {scoped.length > 0 ? (
        <div
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-warn-bg px-4 py-2.5 text-sm text-warn"
          role="status"
        >
          <span className="inline-flex items-center gap-2">
            <Pause className="size-3.5 shrink-0" aria-hidden />
            {phone
              ? "Paused. Nothing will send."
              : scoped.length === 1
                ? `${scoped[0].name} is paused. Enquiry will keep reading. Nothing will send.`
                : "Enquiry is paused on a workspace. Nothing will send."}
          </span>
          <Button
            size="sm"
            variant="secondary"
            className="h-8"
            onClick={() => scoped.forEach((b) => resume(b.id))}
          >
            Resume
          </Button>
        </div>
      ) : null}
    </div>
  );
}
