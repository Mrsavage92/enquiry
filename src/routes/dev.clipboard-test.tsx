import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { OPEN_LINKS_FLAG, copyText, openLinksEnabled, smsHref, waHref } from "@/domain/send-flow";

/**
 * A two-minute phone check for the founder (doc 51 decisions 3 and 4, section
 * 5 device matrix). Unlinked and noindex; it reads no data and needs no
 * sign-in, so it is safe in production. It runs the same Copy the enquiry
 * screen runs, opens the same text and WhatsApp links, and turns the "Open in
 * Messages" button on for this browser once those links are proven.
 */
export const Route = createFileRoute("/dev/clipboard-test")({
  component: ClipboardTest,
  head: () => ({
    meta: [{ title: "Phone check" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

const SAMPLE = [
  "Hi Tom,",
  "",
  "Thanks for getting in touch about interior painting.",
  "",
  "For 3 rooms, a feature wall & the ceilings, that comes to $2,040 (incl. GST).",
  "",
  "Just let me know if you'd like to go ahead and I'll confirm the day. 🙂",
  "",
  "Thanks,",
  "Sam",
].join("\n");

type Result = { label: string; ok: boolean; detail: string; at: string };

function ClipboardTest() {
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [flag, setFlag] = useState(false);
  const [env, setEnv] = useState({ ua: "", standalone: false, secure: false });

  useEffect(() => {
    setFlag(openLinksEnabled(window.localStorage));
    setEnv({
      ua: navigator.userAgent,
      standalone: window.matchMedia?.("(display-mode: standalone)").matches ?? false,
      secure: window.isSecureContext,
    });
  }, []);

  const log = (label: string, ok: boolean, detail = "") =>
    setResults((r) => [{ label, ok, detail, at: new Date().toLocaleTimeString() }, ...r]);

  // The same handler shape as the enquiry screen: writeText first, nothing awaited before it.
  const copy = (label: string) => {
    copyText(SAMPLE).then(
      () => log(label, true, "The clipboard took it. Paste below to check."),
      (err: unknown) =>
        log(label, false, err instanceof Error ? err.name || err.message : "refused"),
    );
  };
  const ios = phone ? smsHref(phone, SAMPLE, "iPhone") : null;
  const android = phone ? smsHref(phone, SAMPLE, "Android") : null;
  const wa = phone ? waHref(phone, SAMPLE) : null;

  return (
    <main className="mx-auto max-w-md px-4 py-6 text-ink">
      <h1 className="text-xl font-semibold">Phone check</h1>
      <p className="mt-2 text-sm text-ink-2">
        Open this on your iPhone (in Safari, then again from the home-screen app). Tap each step,
        note what happened, and send the results back. Nothing here reads or sends any enquiry.
      </p>
      <p className="mt-2 text-xs text-ink-2">
        {env.standalone ? "Home-screen app" : "Browser tab"} ·{" "}
        {env.secure ? "secure" : "NOT secure - clipboard needs https"} · {env.ua}
      </p>

      <section className="mt-5 space-y-3">
        <h2 className="text-base font-semibold">1. Copy</h2>
        <button
          type="button"
          className="laser-bar-button w-full rounded-md bg-mark text-mark-fg"
          onClick={() => copy("Copy, first tap")}
        >
          Copy the sample reply
        </button>
        <p className="text-sm text-ink-2">
          Then wait 30 seconds and tap it again. Paste here to check the text arrived whole:
        </p>
        <textarea className="field w-full" rows={4} aria-label="Paste here" />
      </section>

      <section className="mt-5 space-y-3">
        <h2 className="text-base font-semibold">2. Open in Messages and WhatsApp</h2>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-2">Your own mobile number</span>
          <input
            className="field w-full"
            inputMode="tel"
            value={phone}
            placeholder="0412 345 678"
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        {[
          { label: "Messages, iPhone form (&body=)", href: ios },
          { label: "Messages, Android form (?body=)", href: android },
          { label: "WhatsApp (wa.me)", href: wa },
        ].map((l) =>
          l.href ? (
            <a
              key={l.label}
              href={l.href}
              className="flex min-h-12 items-center justify-center rounded-md border border-ink-2 text-sm font-medium"
              onClick={() => copy(`${l.label} (also copies)`)}
            >
              {l.label}
            </a>
          ) : null,
        )}
        <p className="text-sm text-ink-2">
          For each: did the app open with the whole reply in it, line breaks, $ and & intact?
        </p>
      </section>

      <section className="mt-5 space-y-3">
        <h2 className="text-base font-semibold">3. Turn on Open in Messages</h2>
        <p className="text-sm text-ink-2">
          Only once step 2 worked on this phone. This browser only; off by default everywhere else.
        </p>
        <button
          type="button"
          className="flex min-h-12 w-full items-center justify-center rounded-md border border-ink-2 text-sm font-medium"
          aria-pressed={flag}
          onClick={() => {
            try {
              if (flag) window.localStorage.removeItem(OPEN_LINKS_FLAG);
              else window.localStorage.setItem(OPEN_LINKS_FLAG, "on");
              setFlag(!flag);
            } catch {
              log("Flag", false, "This browser blocks storage");
            }
          }}
        >
          {flag ? "On for this browser - tap to turn off" : "Off - tap to turn on"}
        </button>
      </section>

      <section className="mt-5" aria-live="polite">
        <h2 className="text-base font-semibold">Results</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {results.map((r, i) => (
            <li key={i} className={r.ok ? "text-ok" : "text-danger"}>
              {r.at} · {r.label}: {r.ok ? "worked" : "failed"} {r.detail}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
