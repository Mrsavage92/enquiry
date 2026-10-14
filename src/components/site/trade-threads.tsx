import { useLayoutEffect, useRef, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { ClipboardPaste } from "lucide-react";
import { PhoneFrame } from "@/components/site/device-frame";
import { TRADE_THREADS } from "@/lib/site/trade-thread-content";
import type { TradeThread } from "@/lib/site/trade-threads";
import { useNarrow } from "@/lib/use-narrow";

/**
 * "Built for your trade": one example enquiry per trade, from the customer's
 * message to the reply, inside a phone.
 *
 * Layout from 21st hirael feature-11 (id 27081): a vertical tab list beside
 * the panel it controls, on Radix Tabs (already a dependency), turned into a
 * horizontal segmented control on a phone. The thread inside the phone takes
 * the reveal-one-message-at-a-time idea from 21st solaceui chat-messages-2
 * (id 20130) and nexus-ui chat-messages (id 20129), rebuilt on CSS
 * transitions and an IntersectionObserver because both ship framer-motion,
 * which would be a new runtime dependency. The phone is the project's own
 * PhoneFrame.
 *
 * Every verdict, check and reply comes from the real engine (see
 * src/lib/site/trade-threads.ts). Every panel is force-mounted, so all three
 * threads are in the server-rendered markup for crawlers and with JavaScript
 * off; the inactive ones are hidden by CSS on Radix's data-state, and each
 * keeps its role="tabpanel" and aria-labelledby. Without JavaScript the first
 * thread shows and the tabs cannot switch. The reveal only fades steps in once
 * the section scrolls into view, and never runs under reduced motion.
 */

const STEP_MS = 700;
const STEPS = 4;
const NARROW_PX = 1000;

export function TradeThreads() {
  const narrow = useNarrow(NARROW_PX);
  const { ref, shown } = useReveal();
  const firstId = TRADE_THREADS[0]!.id;
  return (
    <section className="trade-band" aria-labelledby="trade-title">
      <div className="public-container public-section">
        <div className="public-section-heading">
          <p className="public-kicker">Built for your trade</p>
          <h2 id="trade-title">Paste in an enquiry. Get a straight answer and the reply.</h2>
          <p>
            You bring each enquiry in yourself: copy it from a text, email or DM and paste it in. It
            checks the job against your own prices and rules, says Yes, No or Not yet, and writes
            the reply for you to send.
          </p>
        </div>
        <Tabs.Root
          ref={ref}
          defaultValue={firstId}
          orientation={narrow ? "horizontal" : "vertical"}
          className="trade-tabs"
        >
          <Tabs.List className="trade-tab-list" aria-label="Example enquiry by trade">
            {TRADE_THREADS.map((thread) => (
              <Tabs.Trigger key={thread.id} value={thread.id} className="trade-tab">
                <span className="trade-tab-title">{thread.tab}</span>
                {/* On a phone the summary is hidden; the answer word still shows. */}
                <span className="trade-tab-hint" data-tone={toneOf(thread.verdict.word)}>
                  {thread.verdict.word}
                </span>
                <span className="trade-tab-sum">
                  {thread.verdict.word}: {verdictReason(thread)}
                </span>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          {TRADE_THREADS.map((thread) => (
            <Tabs.Content
              key={thread.id}
              value={thread.id}
              className="trade-panel"
              forceMount
            >
              <ThreadPhone thread={thread} shown={thread.id === firstId ? shown : STEPS} />
              <ThreadNotes thread={thread} />
            </Tabs.Content>
          ))}
        </Tabs.Root>
      </div>
    </section>
  );
}

/** "Not yet - one detail decides it" -> "One detail decides it". */
function verdictReason(thread: TradeThread): string {
  const reason = thread.verdict.line.slice(thread.verdict.word.length).replace(/^\s*-\s*/, "");
  return reason.charAt(0).toUpperCase() + reason.slice(1);
}

function sentence(text: string): string {
  return /[.?!]$/.test(text) ? text : `${text}.`;
}

/**
 * How many steps of the first thread are showing. It runs once per page:
 * every other tab mounts with its thread already shown, so switching tabs
 * never blanks a panel and fades it back in.
 *
 * Everything is showing until JavaScript has mounted, confirmed motion is
 * allowed and found the section still below the fold, so a failed script, a
 * crawler, a reduced-motion reader or a section already on screen always gets
 * the whole thread with no flash. The check runs before paint.
 */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(STEPS);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    const timers: number[] = [];
    const showAll = () => setShown(STEPS);
    setShown(0);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        for (let step = 1; step <= STEPS; step += 1) {
          timers.push(window.setTimeout(() => setShown(step), (step - 1) * STEP_MS + 150));
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    window.addEventListener("beforeprint", showAll);
    return () => {
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("beforeprint", showAll);
    };
  }, []);
  return { ref, shown };
}

function ThreadPhone({ thread, shown }: { thread: TradeThread; shown: number }) {
  const step = (index: number) => ({ "data-in": index < shown ? "true" : "false" });
  return (
    <PhoneFrame className="trade-phone">
      <div className="trade-screen">
        <div className="trade-screen-head">
          <span className="trade-avatar" aria-hidden="true">
            {thread.customerName.charAt(0)}
          </span>
          <div>
            <strong>{thread.customerName}</strong>
            <span>Example customer</span>
          </div>
        </div>
        <ol
          className="trade-thread"
          aria-label={`Example ${thread.tab.toLowerCase()} enquiry, from their message to the ready reply`}
        >
          <li className="trade-step trade-step-in" {...step(0)}>
            <span className="sr-only">{thread.customerName} writes:</span>
            <p className="trade-bubble trade-bubble-in">{thread.message}</p>
          </li>
          <li className="trade-step trade-step-paste" {...step(1)}>
            <span className="trade-paste">
              <ClipboardPaste size={15} aria-hidden="true" />
              You paste it in
            </span>
          </li>
          <li className="trade-step" {...step(2)}>
            <div className="trade-verdict">
              <p className="trade-verdict-word" data-tone={toneOf(thread.verdict.word)}>
                {thread.verdict.word}
              </p>
              <p className="trade-verdict-reason">{verdictReason(thread)}</p>
              <p className="trade-label">What it checked</p>
              <p className="trade-checked">{sentence(thread.checked)}</p>
              {thread.ownerSteps.length > 0 ? (
                <>
                  <p className="trade-label">Your taps first</p>
                  <ul className="trade-taps">
                    {thread.ownerSteps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          </li>
          <li className="trade-step trade-step-out" {...step(3)}>
            <p className="trade-label">Ready reply. You send it.</p>
            <p className="trade-bubble trade-bubble-out">{thread.reply}</p>
          </li>
        </ol>
      </div>
    </PhoneFrame>
  );
}

function toneOf(word: TradeThread["verdict"]["word"]): "yes" | "no" | "not-yet" {
  return word === "Yes" ? "yes" : word === "No" ? "no" : "not-yet";
}

function ThreadNotes({ thread }: { thread: TradeThread }) {
  const owner = thread.ownerFirstName;
  return (
    <div className="trade-notes">
      <p className="trade-example-tag">Example</p>
      <dl>
        <div>
          <dt>The business</dt>
          <dd>
            A sample {thread.tab.toLowerCase()} business run by {owner}. {thread.customerName} is
            made up.
          </dd>
        </div>
        <div>
          <dt>{owner}&apos;s saved prices and rules</dt>
          <dd>
            <ul>
              {thread.ownerLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt>What {owner} typed when pasting it in</dt>
          <dd>{thread.serviceLabel ? `"${thread.serviceLabel}"` : "Nothing, just the message"}</dd>
        </div>
      </dl>
      <p className="trade-notes-source">
        The answer and the reply were produced by the app from these inputs, not written for this
        page. Nothing is sent until you send it.
      </p>
    </div>
  );
}
