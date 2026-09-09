import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,color,box-shadow,opacity,scale,border-color] duration-150 ease-out disabled:pointer-events-none disabled:bg-line-strong disabled:text-ink-2 disabled:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mark active:scale-[0.96]",
  {
    variants: {
      variant: {
        primary: "bg-mark text-mark-fg hover:bg-mark-hover",
        // Reserved for a small set of high-confidence moments (landing hero
        // CTA, onboarding submit) - never a default/site-wide swap.
        "primary-strong": "bg-mark-strong text-mark-fg hover:bg-mark",
        // A solid border, not shadow-border's translucent ring
        // (#1a181414, ~8% alpha ink): that ring measured 1.30:1 against its
        // own bg-raised fill and 1.20:1 against the page, both far under
        // WCAG 1.4.11's 3:1 floor for a necessary UI-component boundary.
        // border-ink-2 clears 3:1 against every background this variant
        // actually sits on - raised 8.21:1, paper 7.61:1, paper-2 6.65:1,
        // warn-bg 7.54:1, ok-bg 7.53:1, danger-bg 7.60:1 - so one token
        // covers the button's own fill and every surrounding surface, no
        // per-usage exception needed. line-control (already the token for
        // "necessary boundary" elsewhere, i.e. input/select/textarea
        // borders) was tried first but only clears 3:1 on raised (3.36:1)
        // and paper (3.11:1) - it fails at 2.72:1 on paper-2, which the
        // voice-notice callout (intelligence.tsx) actually uses behind this
        // exact variant. The drop-shadow layer is unchanged (still the same
        // literal alpha-hex as shadow-border/-hover) - only the ring moved
        // from a translucent shadow to an opaque border.
        secondary:
          "border border-ink-2 bg-raised text-ink shadow-[0_1px_2px_#1a18140a] hover:border-ink hover:shadow-[0_1px_3px_#1a18140f]",
        ghost: "text-ink-2 hover:bg-paper-2 hover:text-ink",
        inverse: "text-sidebar-fg hover:bg-sidebar-fg/10 hover:text-sidebar-fg",
        danger: "bg-danger text-paper hover:opacity-90",
        warn: "bg-warn-bg text-warn shadow-border hover:shadow-border-hover",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-11 min-h-11 px-4",
        lg: "h-11 px-5",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild,
  ref,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean; ref?: Ref<HTMLButtonElement> }) {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
