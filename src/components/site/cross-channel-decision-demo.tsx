import { useEffect, useId, useRef, useState } from "react";
import { useSignatureDemo } from "@/lib/site/use-signature-demo";
import { Link, useNavigate } from "@tanstack/react-router";
import { useArrowGroup } from "@/components/site/use-arrow-group";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Info,
  Link2,
  Store,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { decisionScrollDelta } from "@/lib/site/demo-scroll";
import {
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
  const { demo, businesses } = useSignatureDemo();
  const Heading = headingLevel;
  const [scene, setScene] = useState<SignatureScene>(initialScene);
  const [business, setBusiness] = useState<SignatureBusinessId>(initialBusiness);
  const [whyOpenId, setWhyOpenId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Through the router, not history.replaceState: TanStack history turns a raw
  // replaceState into a router load, and that load reset scroll to the top.
  const show = (nextScene: SignatureScene, nextBusiness: SignatureBusinessId) => {
    setScene(nextScene);
    setBusiness(nextBusiness);
    setWhyOpenId(null);
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
  const businessIndex = businesses.findIndex((b) => b.id === business);
  const businessKeys = useArrowGroup(businesses.length, businessIndex, (index) =>
    show(scene, businesses[index].id),
  );
  const liveId = useId();
  const whyId = useId();
  const verdictRef = useRef<HTMLParagraphElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  // On a phone the verdict sits directly under the controls (CSS). After a
  // tap, scroll only as far as the verdict needs, and never so far that the
  // controls leave the screen (critique round 4 measured the old
  // scroll-to-verdict pushing them 98px above the top).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 860px)").matches) return;
    keepDecisionInView(controlsRef.current, verdictRef.current);
  }, [scene, business]);

  const state = signatureState(scene, business, businesses);
  const current = signatureBusiness(business, businesses);
  const later = scene === "text";
  const changedFacts = later ? state.facts.filter((fact) => fact.from) : [];

  return (
    <div className={cn("decision-demo w-full", summary && "decision-demo-summary")}>
      {compact || summary ? null : (
        <header className="max-w-3xl">
          <p className="eyebrow">{demo.business}</p>
          <span className="page-rule" aria-hidden />
          <Heading className="site-display-proof mt-5">{demo.headline}</Heading>
          <p className="site-lede mt-5">{demo.supporting}</p>
        </header>
      )}

      <div ref={controlsRef} className={cn("demo-controls", compact || summary ? "" : "mt-10")}>
        {summary ? null : (
          <div
            className="scene-steps"
            role="group"
            aria-label="Message"
            onKeyDown={sceneKeys.onKeyDown}
          >
            <span className="business-toggle-label">Message</span>
            <button
              type="button"
              ref={sceneKeys.bind(0)}
              aria-pressed={scene === "form"}
              onClick={goForm}
            >
              <span className="scene-step-number">01</span>
              Website form
            </button>
            <ArrowRight className="scene-step-arrow" size={16} aria-hidden="true" />
            <button
              type="button"
              ref={sceneKeys.bind(1)}
              aria-pressed={scene === "text"}
              onClick={goText}
            >
              <span className="scene-step-number">02</span>
              Then Maya texts
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
          {businesses.map((b, index) => (
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
      </div>

      <div className="demo-workspace">
        <p className="demo-verdict" ref={verdictRef} aria-live="polite" aria-atomic="true">
          <span className="demo-verdict-kicker">Verdict</span>
          <strong key={state.verdict}>{state.verdict}</strong>
        </p>
        <div className="demo-conversation">
          {summary ? (
            <MessageCard
              channel={later ? demo.text.channel : demo.form.channel}
              at={later ? demo.text.at : demo.form.at}
              body={later ? demo.text.message : demo.form.message}
              meta={demo.customer}
              incoming={later}
              dense
            />
          ) : (
            <>
              <MessageCard
                channel={demo.form.channel}
                at={demo.form.at}
                body={demo.form.message}
                meta={`${demo.customer} · ${demo.phone}`}
                dense={later}
              />
              {later ? (
                <>
                  <LinkLine label={state.link?.label ?? ""} reason={state.link?.reason ?? ""} />
                  <div className="demo-arrive">
                    <MessageCard
                      channel={demo.text.channel}
                      at={demo.text.at}
                      body={demo.text.message}
                      meta={`${demo.customer} · ${demo.phone}`}
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
                    whyOpen={whyOpenId === check.id}
                    whyId={`${whyId}-${check.id}`}
                    onToggleWhy={() =>
                      setWhyOpenId((open) => (open === check.id ? null : check.id))
                    }
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
        <p className="mt-10 max-w-xl text-base leading-relaxed text-ink-2">{demo.takeaway}</p>
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
        incoming && "demo-message-incoming",
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

/** Hairline-bordered note on the reply tint, led by a link icon: no side stripe. */
function LinkLine({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="demo-arrive demo-link-line flex gap-3 rounded-lg border border-line bg-reply px-4 py-3">
      <Link2 className="mt-0.5 shrink-0 text-mark" size={16} aria-hidden="true" />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{reason}</p>
      </div>
    </div>
  );
}

function keepDecisionInView(controls: HTMLElement | null, verdict: HTMLElement | null) {
  if (!controls || !verdict) return;
  const delta = decisionScrollDelta(
    controls.getBoundingClientRect().top,
    verdict.getBoundingClientRect().bottom,
    window.innerHeight,
  );
  if (delta === 0) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollBy({ top: delta, behavior: reduce ? "auto" : "smooth" });
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
            className="demo-why-link"
            aria-expanded={whyOpen}
            aria-controls={whyId}
            onClick={onToggleWhy}
          >
            Why?
            <ChevronDown className="demo-why-chevron" size={15} aria-hidden="true" />
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
