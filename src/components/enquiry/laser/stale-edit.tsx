import { Button } from "@/components/ui/button";
import { usePrototype } from "@/store/prototype-store";
import { discardSavedDraft, useDraftSaver } from "@/lib/workspace/owner-sync";

/**
 * An edit written before the facts moved (doc 50 section 6, "Stale edit"):
 * never dropped silently. The reply below shows one version at a time, whole,
 * chosen here, and nothing can type over either until the owner picks one.
 */
export function StaleEditChoice({
  enquiryId,
  view,
  onView,
  staleDraft,
}: {
  enquiryId: string;
  view: "new" | "yours";
  onView: (view: "new" | "yours") => void;
  staleDraft: string;
}) {
  const changes = usePrototype((s) => s.draftChanges[enquiryId]);
  const base = usePrototype((s) => s.draftBases?.[enquiryId]);
  const resolveStaleDraft = usePrototype((s) => s.resolveStaleDraft);
  const editDraft = useDraftSaver();
  return (
    <div className="mt-2">
      {changes?.length ? (
        <ul className="space-y-0.5 text-sm text-ink-2" aria-label="What changed">
          {changes.map((c) => (
            <li key={c} className="tabular-nums">
              {c}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="laser-toggle mt-3" role="radiogroup" aria-label="Which version to show">
        {(["new", "yours"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={view === v}
            className="laser-toggle-option"
            onClick={() => onView(v)}
          >
            {v === "new" ? "New reply" : "Your edit"}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          className="min-h-11"
          onClick={() => {
            resolveStaleDraft(enquiryId);
            void discardSavedDraft(enquiryId);
            onView("new");
          }}
        >
          Use new reply
        </Button>
        <Button
          className="min-h-11"
          variant="secondary"
          onClick={() => {
            resolveStaleDraft(enquiryId);
            // The kept edit is still based on the reply it was written against.
            editDraft(enquiryId, staleDraft, base ?? staleDraft);
            onView("new");
          }}
        >
          Keep my edit
        </Button>
      </div>
    </div>
  );
}
