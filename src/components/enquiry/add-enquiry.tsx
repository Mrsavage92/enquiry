import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import { decideEnquiry } from "@/domain/decide";
import type { Business } from "@/domain/types";
import { tradeExamples } from "@/domain/trade-examples";
import { ownerError } from "@/lib/owner-error";

/**
 * How a real enquiry gets into Enquiry during first beta.
 *
 * No mailbox, no DM integration, no pretending otherwise. The owner had a
 * conversation somewhere Enquiry cannot see - a phone call, a text, a message
 * on a platform we do not read - and types or pastes what the customer said.
 *
 * This is the honest version of ingestion and it is genuinely useful: the
 * product's value is the decision, not the plumbing that carried the message.
 * Real channel integrations come later, on evidence, and until they exist the
 * app should not imply them.
 */
export function AddEnquiry({
  business,
  onCreated,
  initiallyOpen = false,
  onCancel,
}: {
  business: Business;
  onCreated?: (enquiryId: string) => void;
  initiallyOpen?: boolean;
  onCancel?: () => void;
}) {
  const actions = useFirstBetaActions();
  const [open, setOpen] = useState(initiallyOpen);
  const [body, setBody] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [serviceLabel, setServiceLabel] = useState("");
  const [intakeNote, setIntakeNote] = useState("");
  const [saving, setSaving] = useState(false);
  // Said under the field it is about, never in a toast over the buttons.
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const errorId = useId();

  // Show the operator what Enquiry will do with this BEFORE they commit it, so
  // "it needs the guest count" is visible while they still have the customer's
  // message in front of them.
  const preview = serviceLabel.trim()
    ? decideEnquiry(business, { serviceLabel: serviceLabel.trim(), facts: [] })
    : null;

  const submit = async () => {
    setSaveError(null);
    if (!body.trim()) {
      setBodyError("Paste what the customer said.");
      bodyRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const id = await actions.addEnquiry({
        businessId: business.id,
        body: body.trim(),
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        serviceLabel: serviceLabel.trim(),
        intakeNote: intakeNote.trim(),
      });
      toast.success("Added. Enquiry is working on it.");
      setBody("");
      setCustomerName("");
      setCustomerEmail("");
      setServiceLabel("");
      setIntakeNote("");
      setOpen(false);
      onCreated?.(id);
    } catch (err) {
      setSaveError(ownerError(err));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button className="min-h-11" onClick={() => setOpen(true)}>
        Add an enquiry
      </Button>
    );
  }

  // Examples in the owner's own trade, never another trade's.
  const examples = tradeExamples(business.industry);

  return (
    <div className={initiallyOpen ? "" : "rounded-md bg-raised p-5 shadow-border"}>
      <p className="eyebrow">New enquiry</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Paste what they sent, or type what they said on the phone. Enquiry works from their words.
      </p>

      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="mb-1.5 block text-stone">What the customer said</span>
          <textarea
            ref={bodyRef}
            className="field min-h-28 w-full"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (bodyError && e.target.value.trim()) setBodyError(null);
            }}
            aria-invalid={bodyError ? true : undefined}
            aria-describedby={bodyError ? errorId : undefined}
            placeholder={`e.g. ${examples.message}`}
          />
        </label>
        {bodyError ? (
          <p id={errorId} className="-mt-1.5 text-sm font-medium text-danger">
            {bodyError}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block text-stone">Their name</span>
            <input
              className="field w-full"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={`e.g. ${examples.customerName}`}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-stone">Email or phone (optional)</span>
            <input
              className="field w-full"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder={`e.g. ${examples.customerEmail}`}
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1.5 block text-stone">What are they asking for?</span>
          <input
            className="field w-full"
            value={serviceLabel}
            onChange={(e) => setServiceLabel(e.target.value)}
            placeholder={`e.g. ${examples.service}`}
          />
          {preview ? (
            <span className="mt-1.5 block text-xs text-stone">
              {preview.action === "SEND_QUOTE"
                ? "Enquiry can price this."
                : preview.action === "REQUEST_INFORMATION"
                  ? `Enquiry will need the ${preview.blocker?.field} before it can price this.`
                  : preview.explanation}
            </span>
          ) : null}
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-stone">How did it reach you? (optional)</span>
          <input
            className="field w-full"
            value={intakeNote}
            onChange={(e) => setIntakeNote(e.target.value)}
            placeholder={`e.g. ${examples.intakeNote}`}
          />
        </label>
      </div>

      {saveError ? (
        <p role="alert" className="mt-4 text-sm font-medium text-danger">
          {saveError}
        </p>
      ) : null}
      <div className="mt-5 flex gap-2">
        <Button className="min-h-11" disabled={saving} onClick={() => void submit()}>
          {saving ? "Adding…" : "Add enquiry"}
        </Button>
        <Button
          variant="secondary"
          className="min-h-11"
          onClick={() => {
            setOpen(false);
            onCancel?.();
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
