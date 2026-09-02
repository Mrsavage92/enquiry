import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePrototype } from "@/store/prototype-store";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import { activeRules } from "@/domain/decide";
import { describeRule } from "@/domain/business-rule";
import type { Business } from "@/domain/types";

/**
 * Where a business tells Enquiry what it charges.
 *
 * This is the input side of the decision layer. Without at least one rule here
 * Enquiry cannot price anything and says so honestly rather than guessing - so
 * this screen is the difference between the product working and the product
 * being a nicely-worded empty promise.
 *
 * Deliberately two rule shapes, not a rule builder. Most service pricing is
 * either a flat fee or a per-something with a minimum, and a business that
 * needs more than this in week one is not the first-beta customer.
 */
export function PricingRules({ business }: { business: Business }) {
  const demoMode = usePrototype((s) => s.demoMode);
  const actions = useFirstBetaActions();
  const rules = activeRules(business);

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"fixed_price" | "per_unit">("per_unit");
  const [service, setService] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("person");
  const [quantityField, setQuantityField] = useState("guests");
  const [minimumQuantity, setMinimumQuantity] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setService("");
    setAmount("");
    setMinimumQuantity("");
    setOpen(false);
  };

  const save = async () => {
    const parsedAmount = Number.parseFloat(amount);
    if (!service.trim()) return toast.error("Name the service this prices.");
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      return toast.error("Enter a real amount.");
    }
    setSaving(true);
    try {
      await actions.saveRule(business.id, {
        kind,
        service: service.trim(),
        amount: parsedAmount,
        currency: "AUD",
        ...(kind === "per_unit"
          ? {
              unit: unit.trim() || "unit",
              quantityField: quantityField.trim() || "quantity",
              minimumQuantity: minimumQuantity ? Number.parseInt(minimumQuantity, 10) : undefined,
            }
          : {}),
      });
      toast.success("Saved. Enquiry can price this now.");
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save that rule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow">What you charge</p>
          <h2 className="site-display mt-2">Pricing Enquiry can use</h2>
        </div>
        {!demoMode ? (
          <Button
            size="sm"
            variant={rules.length ? "secondary" : "primary"}
            className="min-h-11"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Cancel" : "Add a price"}
          </Button>
        ) : null}
      </div>

      {rules.length === 0 && !open ? (
        <p className="site-lede mt-4">
          Enquiry cannot price anything yet. Add what you charge and it will work out totals from
          real enquiries - and tell you what it still needs when it cannot.
        </p>
      ) : null}

      {rules.length > 0 ? (
        <ul className="mt-5">
          {rules.map((r) => (
            <li key={describeRule(r)} className="border-t border-line py-3 text-sm last:border-b">
              {describeRule(r)}
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <div className="mt-6 rounded-md bg-raised p-5 shadow-border">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={kind === "per_unit" ? "primary" : "secondary"}
              onClick={() => setKind("per_unit")}
            >
              Per person / hour / item
            </Button>
            <Button
              size="sm"
              variant={kind === "fixed_price" ? "primary" : "secondary"}
              onClick={() => setKind("fixed_price")}
            >
              One flat price
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="mb-1.5 block text-stone">What is it called?</span>
              <input
                className="field w-full"
                value={service}
                onChange={(e) => setService(e.target.value)}
                placeholder="Group makeup"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-stone">
                {kind === "per_unit" ? "Price each (AUD)" : "Price (AUD)"}
              </span>
              <input
                className="field w-full"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="145"
              />
            </label>

            {kind === "per_unit" ? (
              <>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-stone">Priced per</span>
                  <input
                    className="field w-full"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="person"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-stone">
                    What Enquiry must know to count them
                  </span>
                  <input
                    className="field w-full"
                    value={quantityField}
                    onChange={(e) => setQuantityField(e.target.value)}
                    placeholder="guests"
                  />
                  <span className="mt-1.5 block text-xs text-stone">
                    If an enquiry does not say this, Enquiry asks for it instead of guessing.
                  </span>
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-stone">Minimum charged (optional)</span>
                  <input
                    className="field w-full"
                    inputMode="numeric"
                    value={minimumQuantity}
                    onChange={(e) => setMinimumQuantity(e.target.value)}
                    placeholder="3"
                  />
                </label>
              </>
            ) : null}
          </div>

          <Button className="mt-5 min-h-11" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save this price"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
