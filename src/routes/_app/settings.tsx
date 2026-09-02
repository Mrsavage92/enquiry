import { Link, createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { usePrototype } from "@/store/prototype-store";
import { toast } from "sonner";
import { InstallAppBlock } from "@/components/shell/install-app";
import { useNarrow } from "@/lib/use-narrow";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings · Enquiry" }] }),
});

export function SettingsPage() {
  const businesses = usePrototype((s) => s.businesses);
  const filter = usePrototype((s) => s.businessFilter);
  const pause = usePrototype((s) => s.pause);
  const resume = usePrototype((s) => s.resume);
  const reset = usePrototype((s) => s.reset);
  const demoMode = usePrototype((s) => s.demoMode);
  const startSetup = usePrototype((s) => s.startSetup);
  const prefs = usePrototype((s) => s.prefs);
  const setPrefs = usePrototype((s) => s.setPrefs);
  const connect = usePrototype((s) => s.connectIntegration);
  const phone = useNarrow(860);
  const id = filter === "all" ? businesses[0]?.id : filter;
  const current = businesses.find((b) => b.id === id);
  const paused = current?.paused;
  const mailbox = current?.integrations.find((i) => i.kind === "email");
  const calendar = current?.integrations.find((i) => i.kind === "calendar");

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-5 pb-8 sm:py-8">
      <PageHeader
        title="Settings"
        description={phone ? undefined : "The Enquiry app. Hours, how work arrives, this phone."}
      />

      <section className="mt-8">
        <p className="eyebrow">The app</p>
        <ul className="ledger mt-3">
          <InstallAppBlock />
          <li>
            <p className="font-medium">{current?.name ?? "Workspace"}</p>
            <p className="mt-1 text-sm text-ink-2">
              {paused
                ? "Paused. Enquiry will keep reading. Nothing will send."
                : "Live. You review. You send."}
            </p>
            <div className="mt-3">
              <Button
                size="sm"
                variant={paused ? "secondary" : "warn"}
                onClick={() => {
                  if (!id) return;
                  if (paused) resume(id);
                  else pause(id, "outbound");
                }}
              >
                {paused ? "Resume Enquiry" : "Pause outbound"}
              </Button>
            </div>
          </li>
          <li>
            <p className="font-medium">Working hours</p>
            {phone ? null : (
            <p className="mt-1 text-sm text-ink-2">
              Used for follow-up timing. Enquiry will not invent a diary from this.
            </p>
            )}
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm">
                <span className="mb-1 block text-stone">Days</span>
                <input
                  className="field h-11"
                  value={prefs.workingDays}
                  onChange={(e) => setPrefs({ workingDays: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-stone">From</span>
                <input
                  type="time"
                  className="field h-11"
                  value={prefs.hoursStart}
                  onChange={(e) => setPrefs({ hoursStart: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-stone">Until</span>
                <input
                  type="time"
                  className="field h-11"
                  value={prefs.hoursEnd}
                  onChange={(e) => setPrefs({ hoursEnd: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-stone">Timezone</span>
                <input
                  className="field h-11"
                  value={prefs.timezone ?? "Australia/Brisbane"}
                  onChange={(e) => setPrefs({ timezone: e.target.value })}
                />
              </label>
            </div>
          </li>
          <li>
            <p className="font-medium">Mailbox</p>
            <p className="mt-1 text-sm text-ink-2">
              {mailbox?.status === "connected"
                ? `${mailbox.accountLabel}. Enquiry reads this inbox.`
                : "No mailbox. Forms and messages still open a case."}
            </p>
            {/*
              No provider handshake exists. The old control flipped a local flag
              and announced "Mailbox connected. Enquiry will keep reading." - a
              real business would believe email ingestion was live and then
              silently receive nothing. Demo keeps the simulated control; live
              states the truth.
            */}
            {mailbox && id && demoMode ? (
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => {
                  connect(id, "email");
                  toast("Mailbox connected. Enquiry will keep reading.");
                }}
                disabled={mailbox.status === "connected"}
              >
                {mailbox.status === "connected" ? "Connected" : "Connect mailbox"}
              </Button>
            ) : (
              <p className="mt-3 text-sm text-stone">
                Not connected. Mailbox reading is not available yet - paste an enquiry in
                and Enquiry will work from that.
              </p>
            )}
          </li>
          <li>
            <p className="font-medium">Calendar</p>
            <p className="mt-1 text-sm text-ink-2">
              {calendar?.status === "connected"
                ? "Free/busy only. Enquiry does not need event titles."
                : "Not connected. Unknown is not busy, and it is not free."}
            </p>
            {calendar && id ? (
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => connect(id, "calendar")}
                disabled={calendar.status === "connected"}
              >
                {calendar.status === "connected" ? "Connected" : "Reconnect calendar"}
              </Button>
            ) : (
              <Button size="sm" variant="secondary" className="mt-3" asChild>
                <Link to="/trust/access">Open access</Link>
              </Button>
            )}
          </li>
          <li>
            <p className="font-medium">How work arrives</p>
            {phone ? null : (
            <p className="mt-1 text-sm text-ink-2">
              Email is one pipe. Forms, texts and Instagram still open a case file. A mailbox is optional.
            </p>
            )}
            <ul className="mt-3 space-y-3">
              {(current?.integrations ?? [])
                .filter((i) => i.kind !== "calendar" && i.kind !== "email")
                .map((i) => (
                  <li key={i.id} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{i.provider}</p>
                      <p className="text-xs text-stone">{i.accountLabel}</p>
                    </div>
                    {i.status === "connected" ? (
                      <p className="text-xs text-ok">Connected</p>
                    ) : id && demoMode ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          connect(id, i.id);
                          toast(`${i.provider} connected. Enquiry will keep reading.`);
                        }}
                      >
                        Connect
                      </Button>
                    ) : (
                      <p className="text-xs text-stone">Not connected yet</p>
                    )}
                  </li>
                ))}
            </ul>
          </li>
          <li>
            <p className="font-medium">Notices</p>
            {phone ? null : (
            <p className="mt-1 text-sm text-ink-2">Quiet signals. Not a notification centre product.</p>
            )}
            <div className="mt-3 space-y-2">
              <Toggle
                label="A new enquiry arrives"
                checked={prefs.notifyArrival}
                onChange={(v) => setPrefs({ notifyArrival: v })}
              />
              <Toggle
                label="Follow-up is due"
                checked={prefs.notifyFollowUp}
                onChange={(v) => setPrefs({ notifyFollowUp: v })}
              />
              <Toggle
                label="Learning is waiting"
                checked={prefs.notifyLearning}
                onChange={(v) => setPrefs({ notifyLearning: v })}
              />
            </div>
          </li>
          {phone ? null : (
          <li>
            <p className="font-medium">Trust Centre</p>
            <p className="mt-1 text-sm text-ink-2">
              Assist, Observe or Private. Action classes stay Ask every time until you change them.
            </p>
            <Button size="sm" variant="secondary" className="mt-3" asChild>
              <Link to="/trust">Open Trust</Link>
            </Button>
          </li>
          )}
          {phone ? null : (
          <li>
            <p className="font-medium">Business Brain</p>
            <p className="mt-1 text-sm text-ink-2">What Enquiry knows, what needs review, and Your Voice.</p>
            <Button size="sm" variant="secondary" className="mt-3" asChild>
              <Link to="/business">Open Business Brain</Link>
            </Button>
          </li>
          )}
          {phone ? null : (
          <li>
            <p className="font-medium">Keyboard</p>
            <p className="mt-1 text-sm text-ink-2">
              ⌘K jump · / find · J/K move · ⌘Enter send · U undo · ? this list
            </p>
          </li>
          )}
        </ul>
      </section>

      <section className="mt-10">
        <p className="eyebrow">Prototype</p>
        <ul className="ledger mt-3">
          <li>
            <p className="font-medium">Set up again</p>
            <p className="mt-1 text-sm text-ink-2">Runs Business Brain onboarding for Glow & Co.</p>
            <Button size="sm" variant="secondary" className="mt-3" asChild>
              <Link to="/onboarding" onClick={() => startSetup()}>
                Start setup
              </Link>
            </Button>
          </li>
          {/*
            Demo-only. This replaces the workspace with F01-F20 sample data; for
            a signed-in business that is an offer to destroy their work and fill
            the screen with another studio's.
          */}
          {demoMode ? (
            <li>
              <p className="font-medium">Reset sample data</p>
              <p className="mt-1 text-sm text-ink-2">Restores F01–F20 and sample bookings. Your session is local.</p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => reset()}>
                Reset prototype
              </Button>
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={
          checked
            ? "h-6 w-10 rounded-full bg-ink p-0.5"
            : "h-6 w-10 rounded-full bg-paper-2 p-0.5"
        }
      >
        <span
          className={
            checked
              ? "block size-5 translate-x-4 rounded-full bg-paper transition-transform"
              : "block size-5 translate-x-0 rounded-full bg-raised shadow-border transition-transform"
          }
        />
      </button>
    </label>
  );
}
