import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { BUSINESSES } from "@/fixtures";
import { toast } from "sonner";
import { usePrototype } from "@/store/prototype-store";
import { useLiveTrustMutations } from "@/lib/workspace/live-mutations";
import { visibleBusinesses } from "@/lib/workspace/resolve-business";
import { WorkspaceSettingUp } from "@/components/shell/workspace-setting-up";
import type { ActionPolicyMode } from "@/domain/types";
import { integrationStatusLabel } from "@/domain/labels";
import { cn } from "@/lib/utils";
import { useNarrow } from "@/lib/use-narrow";
import { CheckCircle2, Circle, Eye, FilePenLine, LockKeyhole } from "lucide-react";

export function TrustOverview() {
  const businesses = usePrototype((s) => s.businesses);
  const demoMode = usePrototype((s) => s.demoMode);
  const filter = usePrototype((s) => s.businessFilter);
  const setFilter = usePrototype((s) => s.setBusinessFilter);
  // Store updates immediately; in live mode the same change is written through
  // to the server, and a failed write is surfaced rather than swallowed.
  const trust = useLiveTrustMutations();
  const lastAutomated = usePrototype((s) => s.lastAutomated);
  // No business means a real tenant whose workspace has not been hydrated yet
  // (R2B). Falling back to businesses[0] here used to resolve to the fixture
  // "glow" studio and render its Brain/trust state as this tenant's own.
  const id = filter === "all" ? businesses[0]?.id : filter;
  const business = businesses.find((b) => b.id === id) ?? businesses[0];
  const autoCount = (business?.actionPolicies ?? []).filter(
    (p) => p.mode === "Automatic when safe",
  ).length;
  const phone = useNarrow(860) !== false;

  // Below every hook. A real tenant with no hydrated workspace (R2B) gets a
  // truthful empty state rather than the fixture studio's trust history.
  if (!business) return <WorkspaceSettingUp />;

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-5 pb-8 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader title="Reply settings" />
        {phone ? null : (
          <label className="block text-sm sm:w-56">
            <span className="mb-1.5 block text-stone">Workspace</span>
            <select
              name="workspace"
              className="field h-11"
              value={id}
              onChange={(e) => setFilter(e.target.value)}
            >
              {/* Live tenants pick from their own businesses. This selector
                  listed the fixture roster unconditionally, so a real signed-in
                  operator saw other studios' names as their "Workspace" options. */}
              {visibleBusinesses(businesses, { demoMode, fixtures: BUSINESSES }).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <h2 className="mt-8 text-lg font-semibold">Your review preference</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">
        Prepared replies and permission to act are separate. Your connection status still applies.
      </p>

      <div className="trust-mode-options" role="group" aria-label="Review preference">
        {(["Private", "Observe", "Assist"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={business.trustMode === m}
            onClick={() => void trust.setTrustMode(business.id, m, (msg) => toast.error(msg))}
            className="trust-mode-choice"
          >
            {m === "Private" ? (
              <LockKeyhole size={21} aria-hidden="true" />
            ) : m === "Observe" ? (
              <Eye size={21} aria-hidden="true" />
            ) : (
              <FilePenLine size={21} aria-hidden="true" />
            )}
            <span>
              <strong>{m}</strong>
              <small>
                {m === "Private"
                  ? "Work from the details you add. No mailbox reading."
                  : m === "Observe"
                    ? "Read-only preference. No outbound actions."
                    : "Prepare replies for your review."}
              </small>
            </span>
            {business.trustMode === m ? (
              <CheckCircle2 size={20} aria-hidden="true" />
            ) : (
              <Circle size={20} aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
      {phone ? null : (
        <p className="mt-3 text-xs text-stone">
          Separate permissions apply to each type of action. Changing this preference does not
          connect an account.
        </p>
      )}

      <dl className="mt-8">
        {business.integrations.map((i) => (
          <div
            key={i.id}
            className="flex items-baseline justify-between gap-4 border-t border-line py-3.5"
          >
            <dt className="text-sm">{i.provider}</dt>
            <dd className="text-sm text-ink-2">
              {i.status === "connected" ? i.enquiryUsage[0] : integrationStatusLabel(i.status)}
            </dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4 border-t border-line py-3.5">
          <dt className="text-sm">Automatic permissions</dt>
          <dd className="text-sm text-ink-2">
            {autoCount} action class{autoCount === 1 ? "" : "es"} enabled
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-b border-line py-3.5">
          <dt className="text-sm">Last automated action</dt>
          <dd className="text-sm text-ink-2">
            {lastAutomated && lastAutomated.businessId === business.id
              ? `${lastAutomated.customerName} · ${new Date(lastAutomated.at).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}`
              : "none yet"}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {business.paused ? (
          <Button
            className="min-h-12"
            onClick={() => void trust.resumeBusiness(business.id, (msg) => toast.error(msg))}
          >
            Resume Enquiry
          </Button>
        ) : (
          <Button
            className="min-h-12"
            variant="warn"
            onClick={() =>
              void trust.pauseBusiness(business.id, "outbound", (msg) => toast.error(msg))
            }
          >
            Pause outbound
          </Button>
        )}
        <Button asChild variant="secondary" className="min-h-12">
          <Link to="/trust/access">Access</Link>
        </Button>
        {phone ? null : (
          <Button asChild variant="secondary">
            <Link to="/trust/automation">Reply permissions</Link>
          </Button>
        )}
      </div>
      {phone ? null : (
        <p className="mt-3 text-xs text-stone">
          Pause blocks outbound actions without changing your connections. Resume from here or the
          banner.
        </p>
      )}
    </div>
  );
}

export function TrustAccess() {
  const businesses = usePrototype((s) => s.businesses);
  const demoMode = usePrototype((s) => s.demoMode);
  const enquiries = usePrototype((s) => s.enquiries);
  const reconnectBusiness = usePrototype((s) => s.reconnectBusiness);
  const filter = usePrototype((s) => s.businessFilter);
  // No business means a real tenant whose workspace has not been hydrated yet
  // (R2B). Falling back to businesses[0] here used to resolve to the fixture
  // "glow" studio and render its Brain/trust state as this tenant's own.
  const id = filter === "all" ? businesses[0]?.id : filter;
  const business = businesses.find((b) => b.id === id) ?? businesses[0];
  const calendarDown = enquiries.some(
    (e) =>
      e.businessId === business?.id &&
      e.decision.evaluators.some(
        (ev) =>
          (ev.type === "capacity" || ev.type === "availability") &&
          ev.status === "UNKNOWN_INTEGRATION",
      ),
  );
  const phone = useNarrow(860) !== false;
  if (!business) return <WorkspaceSettingUp />;
  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-5 pb-8 sm:py-8">
      <PageHeader title="Connections" description={phone ? undefined : business.name} />
      <ul className="ledger mt-6">
        {business.integrations.map((i) => (
          <li key={i.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{i.provider}</p>
                <p className="mt-0.5 text-sm text-stone">{i.accountLabel}</p>
              </div>
              <Badge tone={i.status === "connected" ? "ok" : "warn"}>
                {integrationStatusLabel(i.status)}
              </Badge>
            </div>
            <details className="mt-4">
              <summary className="min-h-11 cursor-pointer py-3 text-sm text-stone">
                Access details
              </summary>
              <div className="mt-2 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="eyebrow">Provider granted</p>
                  <ul className="mt-1.5 space-y-0.5 text-sm text-ink-2">
                    {i.technicalScopes.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="eyebrow">Enquiry uses</p>
                  <ul className="mt-1.5 space-y-0.5 text-sm text-ink-2">
                    {i.enquiryUsage.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {i.kind === "calendar" ? (
                <p className="mt-3 text-sm text-ink-2">
                  Why free/busy? To check whether another commitment overlaps the requested job.
                  Enquiry does not need event titles for this.
                </p>
              ) : null}
              {i.kind === "sms" ? (
                <p className="mt-3 text-sm text-ink-2">
                  Texts arrive as case files. Reply on the same number. Sending stays off until
                  Assist.
                </p>
              ) : null}
              {i.kind === "social" ? (
                <p className="mt-3 text-sm text-ink-2">
                  DMs become case files. Public comments are not quotes - invite them to message, or
                  ignore.
                </p>
              ) : null}
              {i.kind === "form" ? (
                <p className="mt-3 text-sm text-ink-2">
                  A website form that emails you is still a form. Structured fields, fewer invented
                  facts.
                </p>
              ) : null}
            </details>
            {demoMode && i.status !== "connected" && i.kind !== "calendar" ? (
              <Button
                className="mt-3"
                size="sm"
                onClick={() => usePrototype.getState().connectIntegration(business.id, i.id)}
              >
                {i.kind === "email" ? "Connect mailbox" : `Connect ${i.provider}`}
              </Button>
            ) : null}
            {/* Live mode has no handshake to offer, so it says so. */}
            {i.status !== "connected" && !demoMode ? (
              <p className="mt-2 text-xs text-stone">Not connected yet</p>
            ) : null}
            {demoMode && i.status === "connected" && i.kind !== "calendar" ? (
              <div className="mt-3">
                <p className="text-xs text-stone">
                  Enquiry stored: message text and the return address. Not your {i.provider}{" "}
                  password.
                </p>
                <Button
                  className="mt-2"
                  size="sm"
                  variant="ghost"
                  onClick={() => usePrototype.getState().disconnectIntegration(business.id, i.id)}
                >
                  Disconnect {i.provider}
                </Button>
              </div>
            ) : null}
            {i.kind === "calendar" && calendarDown ? (
              <div className="callout mt-4 bg-warn-bg text-warn">
                <p className="text-sm font-medium">
                  Enquiry cannot verify availability on an open job.
                </p>
                <p className="mt-1 text-sm text-ink-2">
                  Availability is unknown until the calendar can be checked.
                </p>
                {demoMode ? (
                  <Button className="mt-3" size="sm" onClick={() => reconnectBusiness(business.id)}>
                    Reconnect calendar
                  </Button>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TrustAutomation() {
  const businesses = usePrototype((s) => s.businesses);
  const filter = usePrototype((s) => s.businessFilter);
  const trust = useLiveTrustMutations();
  const lastAuto = usePrototype((s) => s.lastAutomated);
  const demoMode = usePrototype((s) => s.demoMode);
  // Every hook is called above this line. No business means a real tenant whose
  // workspace has not been hydrated yet (R2B); falling back to businesses[0]
  // used to resolve to the fixture "glow" studio and render its trust state as
  // this tenant's own.
  const id = filter === "all" ? businesses[0]?.id : filter;
  const business = businesses.find((b) => b.id === id) ?? businesses[0];
  if (!business) return <WorkspaceSettingUp />;
  const missing = business.actionPolicies.find((p) => p.action === "REQUEST_INFORMATION");
  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-5 pb-8 sm:py-8">
      <PageHeader
        title="Reply permissions"
        description="Choose what needs your approval. Facts, risk and connection permissions are still checked before any action."
      />
      {/*
        Demo-only. These comparable counts are illustrative, and a real tenant
        has approved nothing - showing them would be exactly the synthetic
        automation evidence the trust model forbids. Gated on demoMode rather
        than on a fixture id, which is the actual meaning.
      */}
      {demoMode ? (
        <details className="mt-6 border-t border-line pt-5">
          <summary className="min-h-11 cursor-pointer text-sm font-medium">
            Sample evidence for missing-information questions
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Enquiry has handled 74 comparable missing-info requests. 72 approved unchanged, 2 edited
            for wording only, 0 factual corrections, 0 pricing or capacity claims.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Enquiry may automatically send a question only when a configured decision-critical fact
            is missing and no high-risk flags are present.
          </p>
        </details>
      ) : null}
      <ul className="ledger mt-2">
        {business.actionPolicies.map((p) => (
          <li key={p.action}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{p.label}</p>
                <p className="mt-0.5 text-xs text-stone">Risk {p.risk}</p>
              </div>
            </div>
            <fieldset className="mt-3">
              <legend className="sr-only">Mode for {p.label}</legend>
              <div className="flex flex-wrap gap-1 rounded-lg bg-paper-2 p-1">
                {(["Never", "Ask every time", "Automatic when safe"] as ActionPolicyMode[]).map(
                  (m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={p.mode === m}
                      disabled={p.risk === "HIGH" && m === "Automatic when safe"}
                      onClick={() =>
                        void trust.setActionPolicy(business.id, p.action, m, (msg) =>
                          toast.error(msg),
                        )
                      }
                      className={cn(
                        "min-h-10 rounded-md px-3 text-xs font-medium transition-[background-color,color] duration-150 disabled:opacity-40",
                        p.mode === m
                          ? "bg-ink text-paper shadow-border"
                          : "text-ink-2 hover:text-ink",
                      )}
                    >
                      {m}
                    </button>
                  ),
                )}
              </div>
            </fieldset>
          </li>
        ))}
      </ul>
      {missing?.mode === "Automatic when safe" ? (
        <p className="callout mt-4 bg-ok-bg text-ok text-sm" role="status">
          {lastAuto && lastAuto.businessId === business.id
            ? `Enquiry sent to ${lastAuto.customerName}. ${lastAuto.reason}`
            : "Automatic when safe is on. Runtime still checks facts, risk and send permission before anything goes out."}
        </p>
      ) : null}
    </div>
  );
}

export function TrustAudit() {
  const audit = usePrototype((s) => s.audit);
  const demoMode = usePrototype((s) => s.demoMode);
  const events = usePrototype((s) => s.events);
  // `events` is the demo click-tracking log (track()), never real audit
  // evidence - it exists so the fixture demo has something to show under
  // "What Enquiry did" without a real send ever happening. audit.length===0
  // is the ordinary state for a brand-new live tenant, and falling back to
  // `events` there regardless of mode rendered a demo customer's fixture id
  // and action as if it were this tenant's own history. The store also clears
  // `events` on the live handoff now, but the fallback is gated here too
  // rather than relying on that alone - a UI reading demo-only state must
  // check demo-only state's own name, not assume upstream cleanup ran.
  const rows =
    audit.length > 0
      ? audit
      : demoMode
        ? [...events].reverse().map((e) => ({
            id: e.id,
            at: new Date(e.at).toISOString(),
            actor: "You",
            summary: `${e.fixtureId} · ${e.action.replaceAll("_", " ")}`,
          }))
        : [];
  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-5 pb-8 sm:py-8">
      <PageHeader
        title="Activity history"
        description="Recorded actions and who allowed them. Newest first."
      />
      {rows.length === 0 ? (
        <p className="mt-8 border-t border-line py-10 text-sm text-stone">
          No actions recorded yet.
        </p>
      ) : (
        <ol className="trust-activity">
          {rows.map((e) => (
            <li key={e.id} className="text-sm">
              <time dateTime={e.at}>{new Date(e.at).toLocaleString("en-AU")}</time>
              <p className="font-medium">{e.summary}</p>
              <small>{e.actor}</small>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
