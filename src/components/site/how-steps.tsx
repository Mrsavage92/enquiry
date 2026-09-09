const STEPS = [
  {
    t: "Bring the enquiry in",
    b: "It might have started in a form, text, Instagram, Facebook, or email. Early access starts by bringing the enquiry into Enquiry yourself. Connected channels will roll out progressively.",
  },
  {
    t: "Enquiry reconstructs the request",
    b: "What they want. What’s known. What’s missing, ambiguous, or conflicting. Enquiry does not guess to fill the gaps.",
  },
  {
    t: "Business Brain supplies the truth",
    b: "Services, rules, voice, and prices where they apply. Customer-specific facts stay on that enquiry. A correction can teach the business, or stay on this job.",
  },
  {
    t: "What can be decided now",
    b: "Enquiry runs only the checks that matter for this request. What can be decided. What’s blocking the next decision. Why. Unknown is a valid answer.",
  },
  {
    t: "You review, then you send",
    b: "The next action is prepared - the reply, the hold, the question that unblocks the rest. Nothing goes out unless that kind of action is allowed. Early access is review-first.",
  },
  {
    t: "The enquiry stays current",
    b: "Add new customer information as the conversation changes. The case file stays current until the work is booked or lost. Connected-channel updates will roll out progressively.",
  },
] as const;

/**
 * The reference has no per-step media on this kind of sequence - it uses its
 * card/list vocabulary instead of an invented illustration. `.mk-card` is the
 * same surface as the "What Enquiry does instead" grid on `/`: a two-column
 * feature list, each item a number label, a title and a body line - the
 * reference pattern's "two-column feature lists" applied where this route has
 * no dedicated capture for an individual step.
 */
export function HowSteps() {
  return (
    <section className="mk-section">
      <div className="mk-container">
        <ul className="grid gap-6 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.t} className="mk-card p-6">
              <p className="mk-label tabular-nums">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mk-h3 mt-3">{s.t}</h3>
              <p className="mk-small mt-3">{s.b}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
