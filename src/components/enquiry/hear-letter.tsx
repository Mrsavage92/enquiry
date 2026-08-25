import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const au = voices.find((v) => /en-AU/i.test(v.lang));
  if (au) return au;
  const gb = voices.find((v) => /en-GB/i.test(v.lang) && /female|serena|martha|kate|susan/i.test(v.name));
  if (gb) return gb;
  return voices.find((v) => /en-GB/i.test(v.lang)) ?? voices.find((v) => v.lang.startsWith("en"));
}

export function HearLetter({
  text,
  compact,
}: {
  text: string;
  compact?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const onVoices = () => setReady(true);
    window.speechSynthesis.addEventListener("voiceschanged", onVoices);
    if (window.speechSynthesis.getVoices().length) setReady(true);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, [text]);

  if (!text.trim()) return null;

  const stop = () => {
    window.speechSynthesis.cancel();
    setPlaying(false);
    utterRef.current = null;
  };

  const start = () => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\n+/g, ". "));
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.rate = 0.96;
    u.pitch = 1;
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
    utterRef.current = u;
    window.speechSynthesis.speak(u);
    setPlaying(true);
  };

  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-11 items-center gap-2 text-sm",
        playing ? "text-ink" : "text-stone hover:text-ink",
        compact && "underline-offset-4 hover:underline",
      )}
      onClick={() => (playing ? stop() : start())}
      aria-pressed={playing}
    >
      <span className={cn("hear-bars", playing && "is-on")} aria-hidden>
        <span />
        <span />
        <span />
      </span>
      {playing ? "Stop" : ready ? "Hear it" : "Hear it"}
    </button>
  );
}
