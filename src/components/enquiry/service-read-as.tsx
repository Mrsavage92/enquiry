import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { factStatusLabel, factStatusTone, formatAud } from "@/domain/labels";
import { serviceAuthority } from "@/domain/service-authority";
import {
  businessServices,
  customerWords,
  serviceNeedsOwner,
  suggestService,
} from "@/domain/service-match";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import type { Business, Enquiry } from "@/domain/types";
import { cn } from "@/lib/utils";

const OTHER = "__other__";

/**
 * Say which service this is: the business's saved services as tap choices,
 * plus "Something else".
 *
 * Typing a service name the owner already set up, on a phone, between jobs,
 * was the slowest step on the enquiry. A choice the message clearly names is
 * pre-selected, marked as a reading, and still waits for the owner's tap:
 * nothing becomes the service until they confirm it (`setEnquiryService`
 * writes the confirmed fact and re-decides).
 */
export function ServiceChooser({
  enquiry,
  business,
  initial,
}: {
  enquiry: Enquiry;
  business: Business | undefined;
  /** What a model read, or the label already on the enquiry. */
  initial?: string;
}) {
  const actions = useFirstBetaActions();
  const name = useId();
  const services = useMemo(() => businessServices(business), [business]);
  const suggested = useMemo(
    () => (initial ? undefined : suggestService(customerWords(enquiry), services)),
    [enquiry, services, initial],
  );
  const start = initial ?? suggested ?? "";
  const known = services.some((s) => s.toLowerCase() === start.toLowerCase());
  const [choice, setChoice] = useState(start ? (known ? start : OTHER) : "");
  const [other, setOther] = useState(start && !known ? start : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setChoice(start ? (known ? start : OTHER) : "");
    setOther(start && !known ? start : "");
    // Re-sync only when what is being confirmed changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enquiry.id, start]);

  const value = choice === OTHER ? other.trim() : choice;

  const submit = async () => {
    if (!value) return toast.error("Choose what they are asking for.");
    setSaving(true);
    try {
      await actions.setService(enquiry.id, value);
      toast.success("Service confirmed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save that.");
    } finally {
      setSaving(false);
    }
  };

  const options = [...services, OTHER];

  return (
    <div className="mt-3">
      <fieldset>
        <legend className="sr-only">Which service is this?</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <label
              key={option}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center rounded-md border px-3 text-sm font-medium",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-mark",
                choice === option
                  ? "border-mark bg-mark text-mark-fg"
                  : "border-ink-2 bg-raised text-ink hover:border-ink",
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name={name}
                value={option}
                checked={choice === option}
                onChange={() => setChoice(option)}
              />
              {option === OTHER ? "Something else" : option}
            </label>
          ))}
        </div>
      </fieldset>
      {choice === OTHER ? (
        <label className="mt-3 block text-sm">
          <span className="mb-1.5 block text-ink-2">What are they asking for?</span>
          <input
            className="field w-full"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
        </label>
      ) : null}
      {suggested && choice === suggested ? (
        <p className="mt-2 text-sm text-ink-2">Picked from their message. Check it.</p>
      ) : null}
      <Button
        className="mt-3 min-h-11 w-full max-w-full sm:w-auto"
        disabled={saving || !value}
        onClick={() => void submit()}
        title={value ? `Confirm: ${value}` : undefined}
      >
        <span className="min-w-0 truncate">
          {saving ? "Working it out…" : value ? `Confirm: ${value}` : "Choose one above"}
        </span>
      </Button>
    </div>
  );
}

/**
 * "Enquiry read this as X" - only shown when `service_label` was set by a
 * model reading the message, or carries no record of who decided it, or when
 * no service is named and the business has prices to choose from. Every path
 * confirms through `setEnquiryService`, which writes a real `confirmed` fact.
 *
 * `bare` renders only the chooser, for the phone's next-step card, where the
 * heading already asks the one question.
 */
export function ServiceReadAs({
  enquiry,
  business,
  bare = false,
}: {
  enquiry: Enquiry;
  business: Business | undefined;
  bare?: boolean;
}) {
  const authority = serviceAuthority(enquiry);
  const fact = authority.state === "proposed" ? authority.fact : undefined;
  const current =
    authority.state === "proposed"
      ? authority.fact.value
      : authority.state === "unattributed"
        ? authority.label
        : "";

  if (!serviceNeedsOwner(enquiry)) return null;

  const naming = authority.state === "absent";
  const provisional = enquiry.decision?.provisionalPrice;
  const chooser = (
    <ServiceChooser
      key={`${enquiry.id}:${current}`}
      enquiry={enquiry}
      business={business}
      initial={current || undefined}
    />
  );
  if (bare) return chooser;

  return (
    <section className="border-b border-line px-5 py-5">
      <div className="flex flex-wrap items-center gap-2">
        {naming ? (
          <p className="text-base font-semibold text-ink">Which service is this?</p>
        ) : fact ? (
          <>
            <Badge tone={factStatusTone(fact.status)}>{factStatusLabel(fact.status)}</Badge>
            <p className="text-sm text-ink-2">
              Enquiry read this as {fact.displayValue || fact.value}.
            </p>
          </>
        ) : (
          <>
            {/* A label with no record of who decided it. Saying so plainly is
                better than implying a confirmation that never happened. */}
            <Badge tone="warn">Not confirmed</Badge>
            <p className="text-sm text-ink-2">
              This is down as {current}, but nothing records you confirming it.
            </p>
          </>
        )}
      </div>
      {provisional ? (
        // Shown so confirming is an informed decision, and labelled so it can
        // never read as a decided quote: `provisionalPrice` is read by no send
        // path.
        <p className="mt-2 text-sm text-ink-2">
          If that is right, this prices at{" "}
          <span className="font-semibold tabular-nums">
            {formatAud(provisional.amountMinor / 100)}
          </span>
          . Not quoted yet - confirm the service first.
        </p>
      ) : null}
      {chooser}
    </section>
  );
}
