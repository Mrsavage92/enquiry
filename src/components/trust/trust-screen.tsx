import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { BUSINESSES } from "@/fixtures";
import { usePrototype } from "@/store/prototype-store";
import type { ActionPolicyMode } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useNarrow } from "@/lib/use-narrow";

export function TrustOverview() {
  const businesses = usePrototype((s) => s.businesses);
  const filter = usePrototype((s) => s.businessFilter);
  const setFilter = usePrototype((s) => s.setBusinessFilter);
  const pause = usePrototype((s) => s.pause);
  const resume = usePrototype((s) => s.resume);
  const setMode = usePrototype((s) => s.setTrustMode);
  const lastAutomated = usePrototype((s) => s.lastAutomated);
  const id = filter === "all" ? "glow" : filter;
  const business = businesses.find((b) => b.id === id) ?? businesses[0];
  const autoCount = business.actionPolicies.filter((p) => p.mode === "Automatic when safe").length;
  const phone = useNarrow(860) !== false;

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-5 pb-8 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          eyebrow={phone ? undefined : "Trust Centre"}
          title={phone ? "Trust" : "What Enquiry can see and do"}
        />
        {phone ? null : (
        <label className="block text-sm sm:w-56">
          <span className="mb-1.5 block text-stone">Workspace</span>
          <select
            className="field h-11"
            value={id}
            onChange={(e) => setFilter(e.target.value)}
          >
            {BUSINESSES.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        )}
      </div>

      <p className="mt-8 text-2xl font-semibold tracking-tight">
        {business.trustMode}
      </p>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">
        {business.trustMode === "Private"
          ? "No mailbox. Work still arrives."
          : business.trustMode === "Observe"
            ? "It can read. It will not send."
            : "You approve each send."}
      </p>

      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        {(["Private", "Observe", "Assist"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(business.id, m)}
            className={cn(
              "rounded-lg px-4 py-4 text-left text-sm transition-[background-color,color,box-shadow] duration-150 ease-out",
              business.trustMode === m
                ? "bg-ink text-paper shadow-border"
                : "bg-raised text-ink shadow-border hover:shadow-border-hover",
            )}
          >
            <p className="font-medium">{m}</p>
            <p className={cn("mt-1.5 text-xs leading-relaxed", business.trustMode === m ? "text-paper/75" : "text-stone")}>
              {m === "Private"
                ? "No mailbox."
                : m === "Observe"
                  ? "Read. Don’t send."
                  : "You approve each send."}
            </p>
          </button>
        ))}
      </div>
      {phone ? null : (
      <p className="mt-3 text-xs text-stone">
        There is no global “give AI control” switch. Autopilot is enabled per action class after evidence.
      </p>
      )}

      <dl className="mt-8">
        {business.integrations.map((i) => (
          <div key={i.id} className="flex items-baseline justify-between gap-4 border-t border-line py-3.5">
            <dt className="text-sm">{i.provider}</dt>
            <dd className="text-sm text-ink-2">
              {i.status === "connected" ? i.enquiryUsage[0] : i.status}
            </dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4 border-t border-line py-3.5">
          <dt className="text-sm">Autopilot</dt>
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
          <Button className="min-h-12" onClick={() => resume(business.id)}>Resume Enquiry</Button>
        ) : (
          <Button className="min-h-12" variant="warn" onClick={() => pause(business.id, "outbound")}>
            Pause outbound
          </Button>
        )}
        <Button asChild variant="secondary" className="min-h-12">
          <Link to="/trust/access">Access</Link>
        </Button>
        {phone ? null : (
        <Button asChild variant="secondary">
          <Link to="/trust/automation">Review automation</Link>
        </Button>
        )}
      </div>
      {phone ? null : (
      <p className="mt-3 text-xs text-stone">
        Pause stops sending. Enquiry will keep reading new requests. Resume from here or the banner.
      </p>
      )}
    </div>
  );
}

export function TrustAccess() {
  const businesses = usePrototype((s) => s.businesses);
  const enquiries = usePrototype((s) => s.enquiries);
  const reconnectBusiness = usePrototype((s) => s.reconnectBusiness);
  const filter = usePrototype((s) => s.businessFilter);
  const id = filter === "all" ? "glow" : filter;
  const business = businesses.find((b) => b.id === id) ?? businesses[0];
  const calendarDown = enquiries.some(
    (e) =>
      e.businessId === business.id &&
      e.decision.evaluators.some(
        (ev) =>
          (ev.type === "capacity" || ev.type === "availability") &&
          ev.status === "UNKNOWN_INTEGRATION",
      ),
  );
  const phone = useNarrow(860) !== false;
  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-5 pb-8 sm:py-8">
      <PageHeader
        title="Access"
        description={phone ? undefined : "Technical provider permission is not the same as what Enquiry chooses to use."}
      />
      <ul className="ledger mt-6">
        {business.integrations.map((i) => (
          <li key={i.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{i.provider}</p>
                <p className="mt-0.5 text-sm text-stone">{i.accountLabel}</p>
              </div>
              <Badge tone={i.status === "connected" ? "ok" : "warn"}>{i.status}</Badge>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
                Why free/busy? To check whether another commitment overlaps the requested job. Enquiry does not need event titles for this.
              </p>
            ) : null}
            {i.kind === "sms" ? (
              <p className="mt-3 text-sm text-ink-2">
                Texts arrive as case files. Reply on the same number. Sending stays off until Assist.
              </p>
            ) : null}
            {i.kind === "social" ? (
              <p className="mt-3 text-sm text-ink-2">
                DMs become case files. Public comments are not quotes — invite them to message, or ignore.
              </p>
            ) : null}
            {i.kind === "form" ? (
              <p className="mt-3 text-sm text-ink-2">
                A website form that emails you is still a form. Structured fields, fewer invented facts.
              </p>
            ) : null}
            {i.status !== "connected" && i.kind !== "calendar" ? (
              <Button
                className="mt-3"
                size="sm"
                onClick={() => usePrototype.getState().connectIntegration(business.id, i.id)}
              >
                {i.kind === "email" ? "Connect mailbox" : `Connect ${i.provider}`}
              </Button>
            ) : null}
            {i.status === "connected" && i.kind !== "calendar" ? (
              <div className="mt-3">
                <p className="text-xs text-stone">
                  Enquiry stored: message text and the return address. Not your {i.provider} password.
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
                <p className="text-sm font-medium">Enquiry cannot verify availability on an open job.</p>
                <p className="mt-1 text-sm text-ink-2">
                  Unknown is not busy, and it is not free. Reconnect, then Enquiry will re-read the diary.
                </p>
                <Button className="mt-3" size="sm" onClick={() => reconnectBusiness(business.id)}>
                  Reconnect calendar
                </Button>
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
  const setPolicy = usePrototype((s) => s.setActionPolicy);
  const id = filter === "all" ? "glow" : filter;
  const business = businesses.find((b) => b.id === id) ?? businesses[0];
  const missing = business.actionPolicies.find((p) => p.action === "REQUEST_INFORMATION");
  const lastAuto = usePrototype((s) => s.lastAutomated);
  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-5 pb-8 sm:py-8">
      <PageHeader
        title="Autopilot by action"
        description="Automatic is necessary but never sufficient. Runtime still checks facts, risk, integrations and permissions."
      />
      {id === "glow" ? (
        <article className="mt-6 border-t border-line pt-5">
          <p className="font-medium">Ready to automate missing-info questions?</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Enquiry has handled 74 comparable missing-info requests. 72 approved unchanged, 2 edited for wording only, 0 factual corrections, 0 pricing or capacity claims.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Enquiry may automatically send a question only when a configured decision-critical fact is missing and no high-risk flags are present.
          </p>
        </article>
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
                {(["Never", "Ask every time", "Automatic when safe"] as ActionPolicyMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={p.risk === "HIGH" && m === "Automatic when safe"}
                    onClick={() => setPolicy(business.id, p.action, m)}
                    className={cn(
                      "min-h-10 rounded-md px-3 text-xs font-medium transition-[background-color,color] duration-150 disabled:opacity-40",
                      p.mode === m ? "bg-ink text-paper shadow-border" : "text-ink-2 hover:text-ink",
                    )}
                  >
                    {m}
                  </button>
                ))}
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
  const events = usePrototype((s) => s.events);
  const rows =
    audit.length > 0
      ? audit
      : [...events].reverse().map((e) => ({
          id: e.id,
          at: new Date(e.at).toISOString(),
          actor: "You",
          summary: `${e.fixtureId} · ${e.action.replaceAll("_", " ")}`,
        }));
  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-5 pb-8 sm:py-8">
      <PageHeader title="Audit" description="What Enquiry did, and who allowed it. Newest first." />
      {rows.length === 0 ? (
        <p className="mt-8 border-t border-line py-10 text-sm text-stone">No actions recorded yet.</p>
      ) : (
        <ol className="ledger mt-6">
          {rows.map((e) => (
            <li key={e.id} className="text-sm">
              <p className="font-medium">{e.summary}</p>
              <p className="mt-0.5 text-xs text-stone">
                {e.actor} · {new Date(e.at).toLocaleString("en-AU")}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
