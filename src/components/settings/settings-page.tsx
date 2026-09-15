import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Bell,
  Building2,
  ChevronDown,
  Clock3,
  MonitorSmartphone,
  Plug,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { WorkspaceDestination } from "@/components/ui/workspace-destination";
import { usePrototype } from "@/store/prototype-store";
import { toast } from "sonner";
import { InstallAppBlock } from "@/components/shell/install-app";
import { integrationStatusLabel } from "@/domain/labels";
import { useLiveTrustMutations } from "@/lib/workspace/live-mutations";

export function SettingsPage() {
  const businesses = usePrototype((s) => s.businesses);
  const filter = usePrototype((s) => s.businessFilter);
  const trust = useLiveTrustMutations();
  const reset = usePrototype((s) => s.reset);
  const demoMode = usePrototype((s) => s.demoMode);
  const startSetup = usePrototype((s) => s.startSetup);
  const prefs = usePrototype((s) => s.prefs);
  const setPrefs = usePrototype((s) => s.setPrefs);
  const connect = usePrototype((s) => s.connectIntegration);
  const id = filter === "all" ? businesses[0]?.id : filter;
  const current = businesses.find((b) => b.id === id);
  const paused = current?.paused;

  return (
    <div className="ui-page-scroll">
      <div className="ui-page settings-page">
        <PageHeader title="Settings" description={current?.name} />
        <div className="settings-groups">
          <SettingsGroup
            icon={Clock3}
            title="Working hours"
            description={`${prefs.workingDays} · ${prefs.hoursStart}–${prefs.hoursEnd}`}
          >
            <p>Follow-up timing. These hours do not confirm booking availability.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-2 block text-stone">Days</span>
                <input
                  className="field h-11"
                  value={prefs.workingDays}
                  onChange={(e) => setPrefs({ workingDays: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="mb-2 block text-stone">Time zone</span>
                <input
                  className="field h-11"
                  value={prefs.timezone ?? "Australia/Brisbane"}
                  onChange={(e) => setPrefs({ timezone: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="mb-2 block text-stone">From</span>
                <input
                  type="time"
                  className="field h-11"
                  value={prefs.hoursStart}
                  onChange={(e) => setPrefs({ hoursStart: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="mb-2 block text-stone">Until</span>
                <input
                  type="time"
                  className="field h-11"
                  value={prefs.hoursEnd}
                  onChange={(e) => setPrefs({ hoursEnd: e.target.value })}
                />
              </label>
            </div>
          </SettingsGroup>
          <SettingsGroup
            icon={Bell}
            title="Notifications"
            description="New enquiries, follow-ups and details to review"
          >
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
              label="Business details need review"
              checked={prefs.notifyLearning}
              onChange={(v) => setPrefs({ notifyLearning: v })}
            />
          </SettingsGroup>
          <SettingsGroup
            icon={Plug}
            title="Connections"
            description={
              demoMode
                ? "Sample connections · not live accounts"
                : "Mailbox, calendar and customer channels"
            }
          >
            <p>
              {demoMode
                ? "These connection states belong to the sample workspace. They do not read real messages or calendars."
                : "Live channel connections are not generally available yet. Add customer messages directly to an enquiry."}
            </p>
            <ul className="ledger mt-4">
              {(current?.integrations ?? []).map((integration) => (
                <li key={integration.id} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{integration.provider}</p>
                    <p className="mt-1 break-words text-xs text-stone">
                      {integration.accountLabel}
                    </p>
                  </div>
                  {demoMode && id ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={integration.status === "connected"}
                      onClick={() => {
                        connect(id, integration.id);
                        toast("Sample connection updated. No live account connected.");
                      }}
                    >
                      {integration.status === "connected" ? "Sample connected" : "Connect sample"}
                    </Button>
                  ) : (
                    <span className="text-xs text-stone">
                      {integrationStatusLabel(integration.status)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="workspace-destinations">
              <WorkspaceDestination
                to="/trust/access"
                icon={Plug}
                title="Connection details"
                description="Access, status and permissions"
              />
            </div>
          </SettingsGroup>
          <SettingsGroup
            icon={ShieldCheck}
            title="Permissions"
            description={paused ? "Outbound paused" : "Review preferences and action permissions"}
          >
            <p>
              {paused
                ? "Outbound actions are paused."
                : "Prepared replies still need review. Copying does not send a message."}
            </p>
            <Button
              size="sm"
              variant={paused ? "secondary" : "warn"}
              className="mt-4"
              disabled={!id}
              onClick={() => {
                if (!id) return;
                if (paused) void trust.resumeBusiness(id, (message) => toast.error(message));
                else void trust.pauseBusiness(id, "outbound", (message) => toast.error(message));
              }}
            >
              {paused ? "Resume Enquiry" : "Pause outbound"}
            </Button>
            <div className="workspace-destinations">
              <WorkspaceDestination
                to="/trust"
                icon={ShieldCheck}
                title="Reply settings"
                description="Review mode and action permissions"
              />
              <WorkspaceDestination
                to="/trust/audit"
                icon={Clock3}
                title="Activity history"
                description="Recorded actions and who allowed them"
              />
            </div>
          </SettingsGroup>
          <SettingsGroup
            icon={Building2}
            title="Business"
            description="Services, pricing, policies and voice"
          >
            <div className="workspace-destinations">
              <WorkspaceDestination
                to="/business"
                icon={Building2}
                title="Business details"
                description="Your offer and how you work"
              />
            </div>
          </SettingsGroup>
          <SettingsGroup
            icon={MonitorSmartphone}
            title="This device"
            description="Enquiry on your home screen"
          >
            <ul>
              <InstallAppBlock />
            </ul>
          </SettingsGroup>
        </div>
        {demoMode ? (
          <details className="settings-sample">
            <summary>Sample workspace options</summary>
            <ul className="ledger">
              <li>
                <p className="font-medium">Set up again</p>
                <p className="mt-1 text-sm text-stone">Open the business setup flow.</p>
                <Button size="sm" variant="secondary" className="mt-3" asChild>
                  <Link to="/onboarding" onClick={() => startSetup()}>
                    Start setup
                  </Link>
                </Button>
              </li>
              <li>
                <p className="font-medium">Reset sample data</p>
                <p className="mt-1 text-sm text-stone">
                  Restore the original sample enquiries and bookings on this device.
                </p>
                <Button size="sm" variant="secondary" className="mt-3" onClick={() => reset()}>
                  Reset prototype
                </Button>
              </li>
            </ul>
          </details>
        ) : null}
      </div>
    </div>
  );
}

function SettingsGroup({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <details className="settings-group">
      <summary>
        <span className="workspace-destination-icon">
          <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
        </span>
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <div className="settings-group-content">{children}</div>
    </details>
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
    <label className="flex min-h-12 items-center justify-between gap-4 text-sm">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={
          checked
            ? "h-6 w-10 shrink-0 rounded-full bg-mark p-0.5"
            : "h-6 w-10 shrink-0 rounded-full bg-paper-2 p-0.5"
        }
      >
        <span
          className={
            checked
              ? "block size-5 translate-x-4 rounded-full bg-white transition-transform motion-reduce:transition-none"
              : "block size-5 translate-x-0 rounded-full bg-raised shadow-border transition-transform motion-reduce:transition-none"
          }
        />
      </button>
    </label>
  );
}
