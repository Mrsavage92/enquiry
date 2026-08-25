import { useEffect } from "react";

export function PaperField() {
  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.style.setProperty("--scroll-p", "0");
      return;
    }
    if (window.matchMedia("(max-width: 860px)").matches) {
      return;
    }
    let raf = 0;
    const apply = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const y = window.scrollY;
      root.style.setProperty("--scroll-p", `${(y / max) * 100}%`);
      root.style.setProperty("--field-y", `${y * -0.06}px`);
      root.style.setProperty("--wash-y", `${12 + y * 0.04}vh`);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      root.style.removeProperty("--scroll-p");
      root.style.removeProperty("--field-y");
      root.style.removeProperty("--wash-y");
    };
  }, []);

  return (
    <div className="site-field" aria-hidden>
      <div className="site-field-wash" />
      <div className="site-field-rules" />
      <div className="site-field-grain" />
      <div className="site-gutter" />
    </div>
  );
}
