import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import { decideEnquiry } from "@/domain/decide";
import type { Business } from "@/domain/types";

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
}: {
  business: Business;
  onCreated?: (enquiryId: string) => void;
}) {
  const actions = useFirstBetaActions();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [serviceLabel, setServiceLabel] = useState("");
  const [intakeNote, setIntakeNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Show the operator what Enquiry will do with this BEFORE they commit it, so
  // "it needs the guest count" is visible while they still have the customer's
  // message in front of them.
  const preview = serviceLabel.trim()
    ? decideEnquiry(business, { serviceLabel: serviceLabel.trim(), facts: [] })
    : null;

  const submit = async () => {
    if (!body.trim()) return toast.error("Paste what the customer said.");
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
      toast.error(err instanceof Error ? err.message : "Could not add that enquiry.");
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

  return (
    <div className="rounded-md bg-raised p-5 shadow-border">
      <p className="eyebrow">New enquiry</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Paste what they sent, or type what they said on the phone. Enquiry works from their words.
      </p>

      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="mb-1.5 block text-stone">What the customer said</span>
          <textarea
            className="field min-h-28 w-full"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hi! Need makeup for me and 3 bridesmaids on the 14th. What do you charge?"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block text-stone">Their name</span>
            <input
              className="field w-full"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Sarah"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-stone">Email or phone (optional)</span>
            <input
              className="field w-full"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="sarah@example.com"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1.5 block text-stone">What are they asking for?</span>
          <input
            className="field w-full"
            value={serviceLabel}
            onChange={(e) => setServiceLabel(e.target.value)}
            placeholder="Group makeup"
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
            placeholder="She rang, I typed it up"
          />
        </label>
      </div>

      <div className="mt-5 flex gap-2">
        <Button className="min-h-11" disabled={saving} onClick={() => void submit()}>
          {saving ? "Adding…" : "Add enquiry"}
        </Button>
        <Button variant="secondary" className="min-h-11" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
