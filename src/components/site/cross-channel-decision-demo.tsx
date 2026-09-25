import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useArrowGroup } from "@/components/site/use-arrow-group";
import { ArrowRight, ArrowUpRight, Check, CircleHelp, Info, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  SIGNATURE_BUSINESSES,
  SIGNATURE_DEMO,
  signatureBusiness,
  signatureState,
  type SignatureBusinessId,
  type SignatureCheck,
  type SignatureFact,
  type SignatureScene,
} from "@/lib/site/signature-demo";

/**
 * `headingLevel` exists because this block is the ONLY substantial content on
 * /demo, where its headline is the page's h1. On the homepage it sits under an
 * existing h1, so it must stay an h2 there. Defaulting to h2 keeps every
 * current caller correct.
 */
export function CrossChannelDecisionDemo({
  compact = false,
  summary = false,
  headingLevel = "h2",
  initialScene = "form",
  initialBusiness = "ridge",
  syncUrl = false,
}: {
  compact?: boolean;
  /**
   * Home page proof: the business toggle, the first message, the verdict and
   * the next step. Drops the scene toggle, the business context, the checks
   * and the caution panel; links through to /demo for those.
   */
  summary?: boolean;
  headingLevel?: "h1" | "h2";
  /** Scene to open on; /demo reads it from ?scene=text so a link can land on the follow-up. */
  initialScene?: SignatureScene;
  /** Which sample business answers; /demo reads it from ?business=harbour. */
  initialBusiness?: SignatureBusinessId;
  /** Mirror the state into /demo's search params (router replace, scroll kept) so it is shareable. */
  syncUrl?: boolean;
}) {
  const Heading = headingLevel;
  const [scene, setScene] = useState<SignatureScene>(initialScene);
  const [business, setBusiness] = useState<SignatureBusinessId>(initialBusiness);
  const [whyOpen, setWhyOpen] = useState(false);
  const navigate = useNavigate();

  // Through the router, not history.replaceState: TanStack history turns a raw
  // replaceState into a router load, and that load reset scroll to the top.
  const show = (nextScene: SignatureScene, nextBusiness: SignatureBusinessId) => {
    setScene(nextScene);
    setBusiness(nextBusiness);
    setWhyOpen(false);
    if (!syncUrl) return;
    void navigate({
      to: "/demo",
      search: {
        ...(nextScene === "text" ? { scene: "text" as const } : {}),
        ...(nextBusiness === "harbour" ? { business: "harbour" as const } : {}),
      },
      replace: true,
      resetScroll: false,
    });
  };
  const goText = () => show("text", business);
  const goForm = () => show("form", business);
  const sceneKeys = useArrowGroup(2, scene === "form" ? 0 : 1, (index) =>
    index === 0 ? goForm() : goText(),
  );
  const businessIndex = SIGNATURE_BUSINESSES.findIndex((b) => b.id === business);
  const businessKeys = useArrowGroup(SIGNATURE_BUSINESSES.length, businessIndex, (index) =>
    show(scene, SIGNATURE_BUSINESSES[index].id),
  );
  const liveId = useId();
  const whyId = useId();
  const verdictRef = useRef<HTMLParagraphElement>(null);
  const firstRender = useRef(true);

  // On a phone the verdict can sit below the fold once the toggles are
  // tapped, so bring it into view after the answer changes.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 860px)").matches) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    verdictRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [scene, business]);

  const state = signatureState(scene, business);
  const current = signatureBusiness(business);
  const later = scene === "text";
  const changedFacts = later ? state.facts.filter((fact) => fact.from) : [];

  return (
    <div className={cn("decision-demo w-full", summary && "decision-demo-summary")}>
      {compact || summary ? null : (
        <header className="max-w-3xl">
          <p className="eyebrow">{SIGNATURE_DEMO.business}</p>
          <span className="page-rule" aria-hidden />
          <Heading className="site-display-proof mt-5">{SIGNATURE_DEMO.headline}</Heading>
          <p className="site-lede mt-5">{SIGNATURE_DEMO.supporting}</p>
        </header>
      )}

      {summary ? null : (
        <div
          className={cn("scene-toggle", compact ? "" : "mt-10")}
          role="group"
          aria-label="Maya’s enquiry"
          onKeyDown={sceneKeys.onKeyDown}
        >
          <button
            type="button"
            ref={sceneKeys.bind(0)}
            aria-pressed={scene === "form"}
            onClick={goForm}
          >
            <ToggleCheck />
            01 · Website form
          </button>
          <button
            type="button"
            ref={sceneKeys.bind(1)}
            aria-pressed={scene === "text"}
            onClick={goText}
          >
            <ToggleCheck />
            02 · Then Maya texts…
          </button>
        </div>
      )}

      <div
        className="scene-toggle business-toggle"
        role="group"
        aria-label="Which business receives it"
        onKeyDown={businessKeys.onKeyDown}
      >
        <span className="business-toggle-label">Received by</span>
        {SIGNATURE_BUSINESSES.map((b, index) => (
          <button
            key={b.id}
            type="button"
            ref={businessKeys.bind(index)}
            aria-pressed={business === b.id}
            onClick={() => show(scene, b.id)}
          >
            <ToggleCheck />
            {b.label}
          </button>
        ))}
      </div>
      <p className="business-toggle-rule">
        <strong>{current.label}:</strong> {current.detail}. Rule from {current.rule.sourceLabel}:{" "}
        {current.rule.title.toLowerCase()}.
      </p>

      <div className="demo-workspace">
        <p className="demo-verdict" ref={verdictRef} aria-live="polite" aria-atomic="true">
          <span className="demo-verdict-kicker">Verdict</span>
          <strong key={state.verdict}>{state.verdict}</strong>
        </p>
        <div className="demo-conversation">
          {summary ? (
            <MessageCard
              channel={later ? SIGNATURE_DEMO.text.channel : SIGNATURE_DEMO.form.channel}
              at={later ? SIGNATURE_DEMO.text.at : SIGNATURE_DEMO.form.at}
              body={later ? SIGNATURE_DEMO.text.message : SIGNATURE_DEMO.form.message}
              meta={SIGNATURE_DEMO.customer}
              incoming={later}
              dense
            />
          ) : (
            <>
              <MessageCard
                channel={SIGNATURE_DEMO.form.channel}
                at={SIGNATURE_DEMO.form.at}
                body={SIGNATURE_DEMO.form.message}
                meta={`${SIGNATURE_DEMO.customer} · ${SIGNATURE_DEMO.phone}`}
                dense={later}
              />
              {later ? (
                <>
                  <LinkLine label={state.link?.label ?? ""} reason={state.link?.reason ?? ""} />
                  <div className="demo-arrive">
                    <MessageCard
                      channel={SIGNATURE_DEMO.text.channel}
                      at={SIGNATURE_DEMO.text.at}
                      body={SIGNATURE_DEMO.text.message}
                      meta={`${SIGNATURE_DEMO.customer} · ${SIGNATURE_DEMO.phone}`}
                      incoming
                    />
                  </div>
                </>
              ) : null}
              <section className="demo-context" aria-label="Business context">
                <h2>
                  <Store size={17} aria-hidden="true" /> Business context
                </h2>
                <p>{state.want}</p>
                <dl>
                  {state.facts.map((fact) => (
                    <FactRow key={fact.id} fact={fact} later={later} />
                  ))}
                </dl>
              </section>
            </>
          )}
        </div>

        <article className="demo-action" aria-labelledby={liveId}>
          <div className="demo-next" aria-live="polite">
            <p className="demo-next-label">
              <ArrowUpRight size={18} aria-hidden="true" />
              {later ? "Next step updated" : "Next step"}
            </p>
            <h2
              id={liveId}
              key={state.nextAction}
              className={cn("proof-next", later && "demo-arrive")}
            >
              {state.nextAction}
            </h2>
            <p>{state.nextReason}</p>
            {changedFacts.length > 0 ? (
              <p className="demo-next-changes">
                <span>What changed:</span>{" "}
                {changedFacts.map((fact, index) => (
                  <span key={fact.id}>
                    {index > 0 ? " · " : null}
                    {fact.label} {fact.from} → {fact.value}
                  </span>
                ))}
              </p>
            ) : null}
          </div>

          {summary ? (
            <p className="demo-summary-foot">
              Nothing has been sent or booked.{" "}
              <Link
                to="/demo"
                search={{
                  ...(later ? { scene: "text" as const } : {}),
                  ...(business === "harbour" ? { business: "harbour" as const } : {}),
                }}
                className="public-text-link"
              >
                See why, step by step <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </p>
          ) : null}
          {summary ? null : (
            <section className="demo-reasons" aria-label="Why this step?">
              <h2>
                <CircleHelp size={17} aria-hidden="true" /> Why this step?
              </h2>
              <ul className="mt-4 space-y-1.5">
                {state.checks.map((check) => (
                  <CheckRow
                    key={check.id}
                    check={check}
                    later={later}
                    whyOpen={whyOpen}
                    whyId={whyId}
                    onToggleWhy={() => setWhyOpen((v) => !v)}
                  />
                ))}
              </ul>
            </section>
          )}
          {summary ? null : (
            <section className="demo-caution" aria-label="Keep in mind">
              <h2>
                <Info size={17} aria-hidden="true" /> Keep in mind
              </h2>
              <p>{state.commercialNote}</p>
              <p>
                Nothing has been sent or booked. You review the next step and send through your own
                channel.
              </p>
            </section>
          )}
        </article>
      </div>

      {compact || summary ? null : (
        <p className="mt-10 max-w-xl text-base leading-relaxed text-ink-2">
          {SIGNATURE_DEMO.takeaway}
        </p>
      )}
    </div>
  );
}

/** Shown only on the pressed toggle (CSS), alongside the tint and border. */
function ToggleCheck() {
  return <Check className="toggle-check" size={14} strokeWidth={2.5} aria-hidden="true" />;
}

/** The label each check shows, read off its tone. */
const CHECK_BADGE = {
  ok: { tone: "ok", label: "Clear" },
  check: { tone: "neutral", label: "Check first" },
  warn: { tone: "warn", label: "Condition" },
  block: { tone: "danger", label: "Rules it out" },
  quiet: { tone: "neutral", label: "Noted" },
} as const satisfies Record<SignatureCheck["tone"], { tone: string; label: string }>;

function MessageCard({
  channel,
  at,
  body,
  meta,
  incoming,
  dense,
}: {
  channel: string;
  at: string;
  body: string;
  meta: string;
  incoming?: boolean;
  dense?: boolean;
}) {
  return (
    <article
      className={cn(
        "demo-message",
        dense ? "rounded-md p-4" : "rounded-md p-5 sm:p-6",
        incoming && "border-l-2 border-mark",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow">{channel}</p>
        <p className="demo-message-time text-xs tabular-nums text-stone">{at}</p>
      </div>
      <p
        className={cn(
          "mt-3 leading-relaxed",
          dense ? "text-sm text-ink-2 sm:text-base" : "text-lg",
        )}
      >
        {body}
      </p>
      <p className={cn("text-sm text-stone", dense ? "mt-3" : "mt-4")}>{meta}</p>
    </article>
  );
}

function LinkLine({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="demo-arrive border-l-2 border-mark px-4 py-3">
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">{reason}</p>
    </div>
  );
}

function FactRow({ fact, later }: { fact: SignatureFact; later: boolean }) {
  const changed = later && Boolean(fact.from);
  return (
    <div
      className={cn(
        "flex justify-between gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0",
        changed && "demo-arrive",
      )}
    >
      <dt className="shrink-0 text-sm text-stone">{fact.label}</dt>
      <dd className="min-w-0 text-right text-sm">
        {changed ? (
          <span className="flex flex-col items-end gap-0.5 sm:flex-row sm:flex-wrap sm:justify-end sm:items-baseline sm:gap-2">
            <span className="text-stone line-through">{fact.from}</span>
            <span className="font-medium text-mark">{fact.value}</span>
          </span>
        ) : (
          fact.value
        )}
      </dd>
    </div>
  );
}

function CheckRow({
  check,
  later,
  whyOpen,
  whyId,
  onToggleWhy,
}: {
  check: SignatureCheck;
  later: boolean;
  whyOpen: boolean;
  whyId: string;
  onToggleWhy: () => void;
}) {
  const changed = later && check.changed;
  const { tone, label: badge } = CHECK_BADGE[check.tone];
  const blocking = check.tone === "block";

  if (!changed) {
    return (
      <li className="flex items-start justify-between gap-3 border-t border-line px-0 py-2.5 first:border-t-0 first:pt-0">
        <p className="min-w-0 text-sm leading-snug">
          <span className="text-stone">{check.label}</span>
          <span className="mx-1.5 text-stone">·</span>
          <span>{check.value}</span>
        </p>
        <Badge tone={tone}>{badge}</Badge>
      </li>
    );
  }

  return (
    <li
      className={cn(
        "demo-arrive border-t px-3 py-2.5",
        blocking ? "border-danger/30 bg-danger-bg" : "border-warn/30 bg-warn-bg",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-stone">{check.label}</span>
        <Badge tone={tone}>{badge}</Badge>
      </div>
      <p className="mt-1 text-sm leading-relaxed">{check.value}</p>
      {check.why ? (
        <div className="mt-1">
          <button
            type="button"
            className="min-h-11 text-sm font-medium text-ink underline-offset-4 hover:underline"
            aria-expanded={whyOpen}
            aria-controls={whyId}
            onClick={onToggleWhy}
          >
            Why?
          </button>
          {whyOpen ? (
            <p id={whyId} className="mt-1 text-sm leading-relaxed text-ink-2">
              {check.why}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
