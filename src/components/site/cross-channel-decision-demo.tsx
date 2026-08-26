import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  SIGNATURE_DEMO,
  signatureState,
  type SignatureCheck,
  type SignatureFact,
  type SignatureScene,
} from "@/lib/site/signature-demo";

export function CrossChannelDecisionDemo({ compact = false }: { compact?: boolean }) {
  const [scene, setScene] = useState<SignatureScene>("form");
  const [whyOpen, setWhyOpen] = useState(false);
  const liveId = useId();
  const whyId = useId();
  const state = signatureState(scene);
  const later = scene === "text";

  const goText = () => {
    setScene("text");
    setWhyOpen(false);
  };
  const goForm = () => {
    setScene("form");
    setWhyOpen(false);
  };

  return (
    <div className="w-full">
      {compact ? null : (
        <header className="max-w-2xl">
          <p className="eyebrow">{SIGNATURE_DEMO.business}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {SIGNATURE_DEMO.headline}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-2 sm:text-base">
            {SIGNATURE_DEMO.supporting}
          </p>
        </header>
      )}

      <div className={cn("flex flex-wrap items-center gap-2", compact ? "" : "mt-6")}>
        <Button
          type="button"
          variant={scene === "form" ? "primary" : "secondary"}
          className="min-h-12"
          aria-pressed={scene === "form"}
          onClick={goForm}
        >
          01 · Website form
        </Button>
        <Button
          type="button"
          variant={scene === "text" ? "primary" : "secondary"}
          className="min-h-12"
          aria-pressed={scene === "text"}
          onClick={goText}
        >
          Then Maya texts…
        </Button>
      </div>

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-5">
        <div className="flex flex-col gap-3 lg:col-span-2">
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
        </div>

        <article
          className="rounded-xl bg-raised p-4 shadow-border sm:p-5 lg:col-span-3"
          aria-labelledby={liveId}
        >
          <p className="eyebrow">{later ? "Decision updated" : "Already decided"}</p>
          <p id={liveId} className="mt-2 font-serif text-xl leading-snug tracking-tight sm:text-2xl">
            {state.want}
          </p>

          <div className="mt-4 border-t border-line pt-4" aria-live="polite">
            <p className="text-xs uppercase tracking-wider text-stone">Next</p>
            <p
              key={state.nextAction}
              className={cn(
                "mt-1.5 font-serif text-2xl leading-snug tracking-tight",
                later && "demo-arrive",
              )}
            >
              {state.nextAction}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{state.nextReason}</p>
          </div>

          <dl className="mt-4 space-y-2 text-sm">
            {state.facts.map((fact) => (
              <FactRow key={fact.id} fact={fact} later={later} />
            ))}
          </dl>

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

          <p className="mt-4 text-xs text-stone">{state.commercialNote}</p>
        </article>
      </div>

      {compact ? null : (
        <p className="mt-8 max-w-xl text-sm leading-relaxed text-ink-2">{SIGNATURE_DEMO.takeaway}</p>
      )}
    </div>
  );
}

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
        "rounded-xl bg-raised shadow-border",
        dense ? "p-4" : "p-5 sm:p-6",
        incoming && "ring-1 ring-mark/20",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow">{channel}</p>
        <p className="text-xs tabular-nums text-stone">{at}</p>
      </div>
      <p
        className={cn(
          "mt-3 font-serif leading-relaxed",
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
    <div className="demo-arrive rounded-lg bg-ok-bg px-4 py-3">
      <p className="text-sm font-medium text-ok">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">{reason}</p>
    </div>
  );
}

function FactRow({ fact, later }: { fact: SignatureFact; later: boolean }) {
  const changed = later && Boolean(fact.from);
  return (
    <div
      className={cn(
        "flex justify-between gap-3 border-b border-line pb-1.5 last:border-0",
        changed && "demo-arrive",
      )}
    >
      <dt className="shrink-0 text-stone">{fact.label}</dt>
      <dd className="min-w-0 text-right">
        {changed ? (
          <span className="flex flex-col items-end gap-0.5 sm:flex-row sm:flex-wrap sm:justify-end sm:items-baseline sm:gap-2">
            <span className="text-stone line-through">{fact.from}</span>
            <span className="font-medium">{fact.value}</span>
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
  const tone = check.tone === "ok" ? "ok" : check.tone === "warn" ? "warn" : "neutral";
  const badge = changed && check.tone === "warn" ? "Condition" : check.tone === "ok" ? "Clear" : "Noted";

  if (!changed) {
    return (
      <li className="flex items-start justify-between gap-3 rounded-md bg-paper-2/60 px-3 py-2">
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
    <li className="rounded-md bg-warn-bg px-3 py-2.5 demo-arrive">
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
