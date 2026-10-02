import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { dollarMatches } from "@/domain/voice-detect";
import { cn } from "@/lib/utils";

/**
 * The reply, whole, edited where it sits (doc 50 6.3).
 *
 * The textarea is the one real control, always in the DOM, labelled and
 * reached by Tab like any field. While it is not focused, a read view in the
 * same font and box is laid over it (aria-hidden): it can mark the amount and
 * the sentence that just changed, which a plain textarea cannot draw. A tap on
 * the read view puts the caret at the tapped point. Nothing opens an editor,
 * and nothing scrolls inside the box: it grows with the text.
 */

type Segment = { text: string; kind: "plain" | "amount" | "fresh" };

/** Split the reply into plain text, amounts and freshly changed lines, in order. */
export function segmentsOf(text: string, fresh: readonly string[]): Segment[] {
  const marks: { from: number; to: number; kind: Segment["kind"] }[] = [];
  for (const line of fresh) {
    const at = line.trim() ? text.indexOf(line) : -1;
    if (at >= 0) marks.push({ from: at, to: at + line.length, kind: "fresh" });
  }
  for (const m of dollarMatches(text)) {
    const inside = marks.some((k) => m.index >= k.from && m.index < k.to);
    if (!inside) marks.push({ from: m.index, to: m.index + m.raw.length, kind: "amount" });
  }
  marks.sort((a, b) => a.from - b.from);
  const out: Segment[] = [];
  let at = 0;
  for (const mark of marks) {
    if (mark.from < at) continue;
    if (mark.from > at) out.push({ text: text.slice(at, mark.from), kind: "plain" });
    out.push({ text: text.slice(mark.from, mark.to), kind: mark.kind });
    at = mark.to;
  }
  if (at < text.length) out.push({ text: text.slice(at), kind: "plain" });
  return out;
}

/** The text offset under a point in the read view, for the caret. */
function offsetAt(root: HTMLElement, x: number, y: number): number | null {
  const doc = root.ownerDocument as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const pos = doc.caretPositionFromPoint?.(x, y);
  const range = pos ? null : doc.caretRangeFromPoint?.(x, y);
  const node = pos?.offsetNode ?? range?.startContainer;
  const offset = pos?.offset ?? range?.startOffset;
  if (!node || offset === undefined || !root.contains(node)) return null;
  let total = 0;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n === node) return total + offset;
    total += n.textContent?.length ?? 0;
  }
  return null;
}

export function ReplyBox({
  label,
  text,
  onChange,
  locked,
  fresh,
  readRef,
  onEditing,
  onBlur,
}: {
  /** "Your reply to Tom". */
  label: string;
  text: string;
  onChange: (text: string) => void;
  /** A stale edit not yet kept or dropped: nothing can type over either version. */
  locked: boolean;
  /** Lines that just changed, marked for two seconds. */
  fresh: readonly string[];
  /** The read view, selected by hand-copy when the clipboard refuses. */
  readRef: RefObject<HTMLDivElement | null>;
  onEditing: (editing: boolean) => void;
  onBlur: () => void;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  // Grow with the text where `field-sizing: content` is not supported.
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area || CSS.supports?.("field-sizing", "content")) return;
    area.style.height = "auto";
    area.style.height = `${area.scrollHeight}px`;
  }, [text, focused]);

  useEffect(() => onEditing(focused), [focused, onEditing]);

  const placeCaret = (x: number, y: number) => {
    const area = areaRef.current;
    const read = readRef.current;
    if (!area || locked) return;
    const at = read ? offsetAt(read, x, y) : null;
    area.focus();
    if (at !== null) area.setSelectionRange(at, at);
  };

  return (
    <div className="laser-reply" data-focused={focused || undefined}>
      <p className="laser-reply-label" id="laser-reply-label">
        {locked ? "Your reply - choose a version first" : "Your reply - tap to edit"}
      </p>
      <div className="laser-reply-box">
        <textarea
          ref={areaRef}
          className="laser-reply-text"
          aria-label={label}
          value={text}
          readOnly={locked}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") e.currentTarget.blur();
          }}
        />
        {focused ? null : (
          <div
            ref={readRef}
            aria-hidden
            className="laser-reply-read"
            onClick={(e) => placeCaret(e.clientX, e.clientY)}
          >
            {segmentsOf(text, fresh).map((s, i) =>
              s.kind === "plain" ? (
                <span key={i}>{s.text}</span>
              ) : (
                <mark key={i} className={cn(s.kind === "amount" ? "laser-amount" : "laser-fresh")}>
                  {s.text}
                </mark>
              ),
            )}
            {text.endsWith("\n") ? <br /> : null}
          </div>
        )}
      </div>
    </div>
  );
}
