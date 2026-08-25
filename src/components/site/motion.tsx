import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

function reduced() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced()) {
      setOn(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setOn(true);
        io.disconnect();
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("reveal", on && "is-in", className)}
      style={{ transitionDelay: on ? `${delay}ms` : undefined }}
    >
      {children}
    </div>
  );
}

export function CountUp({
  to,
  prefix = "$",
  className,
}: {
  to: number;
  prefix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced()) {
      setN(to);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const dur = 900;
        const tick = (t: number) => {
          const p = Math.min(1, (t - start) / dur);
          const eased = 1 - (1 - p) ** 3;
          setN(Math.round(to * eased));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}
      {n.toLocaleString("en-AU")}
    </span>
  );
}

export function HeroIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const style: CSSProperties = { animationDelay: `${delay}ms` };
  return (
    <div className={cn("hero-in", className)} style={style}>
      {children}
    </div>
  );
}

export function SiteVideo({
  src,
  poster,
  label,
  className,
}: {
  src: string;
  poster?: string;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const playIf = () => {
      if (mq.matches) {
        v.pause();
        return;
      }
      void v.play().catch(() => undefined);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) playIf();
        else v.pause();
      },
      { threshold: [0, 0.5, 1] },
    );
    io.observe(v);
    mq.addEventListener("change", playIf);
    return () => {
      io.disconnect();
      mq.removeEventListener("change", playIf);
      v.pause();
    };
  }, []);
  return (
    <video
      ref={ref}
      className={cn("pointer-events-none", className)}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      controls={false}
      disablePictureInPicture
      disableRemotePlayback
      aria-label={label}
      title={label}
    />
  );
}
