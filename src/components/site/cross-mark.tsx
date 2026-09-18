/**
 * Corner crosshair, drawn half outside a cell edge like a survey mark.
 *
 * The one decorative device behind the home body's drawn-grid grammar: cells
 * are bordered with hairlines and pinned at two corners by these marks, so
 * three benefits read as cells on a sheet rather than three floating cards.
 * Adapted from 21st.dev hirael feature-08 (id 26797); the pointer-follow
 * spotlight that component ships with is deliberately not carried over.
 *
 * Purely decorative: aria-hidden, no text, so no contrast requirement. Its
 * colour is the strong hairline token, kept below text weight on purpose.
 */
export function CrossMark({ position }: { position: "top-start" | "bottom-end" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      className={`public-cross-mark public-cross-mark-${position}`}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
