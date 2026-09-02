import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const STILLS = {
  makeup: "/product/phone-job.png",
  photo: "/product/phone-photo.png",
  paint: "/product/phone-paint.png",
  inbound: "/product/phone-thread.png",
  desk: "/product/desk.png",
  leaving: "/product/phone-booked.png",
  quote: "/product/quote.png",
  today: "/product/phone-today.png",
  job: "/product/phone-job.png",
} as const;

export function PhoneBezel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-3xl bg-ink p-2 shadow-float", className)}>
      <div className="overflow-hidden rounded-2xl bg-paper">{children}</div>
    </div>
  );
}

export function Still({
  src,
  alt,
  caption,
  className,
  phone = false,
}: {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
  phone?: boolean;
}) {
  const img = (
    <img src={src} alt={alt} className={cn("w-full object-cover", !phone && "rounded-xl")} />
  );
  return (
    <figure className={cn(phone ? "mx-auto w-[min(100%,20rem)]" : "overflow-hidden", className)}>
      {phone ? <PhoneBezel>{img}</PhoneBezel> : img}
      {caption ? (
        <figcaption className={cn("text-sm text-stone", phone ? "mt-3 text-center" : "px-1 pt-3")}>
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function TradeStills() {
  return (
    <ul className="grid gap-8 sm:grid-cols-3">
      {[
        { src: STILLS.makeup, alt: "Priya Shah - group mobile makeup, $625, hold $190.", cap: "Makeup · Priya Shah" },
        { src: STILLS.photo, alt: "Dana Okonkwo - event coverage, $1,260.", cap: "Photography · Dana Okonkwo" },
        { src: STILLS.paint, alt: "Helen Cho - interior painting estimate.", cap: "Painting · Helen Cho" },
      ].map((t) => (
        <li key={t.cap}>
          <Still src={t.src} alt={t.alt} caption={t.cap} phone />
        </li>
      ))}
    </ul>
  );
}
