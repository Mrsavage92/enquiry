import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,color,box-shadow,opacity,scale,border-color] duration-150 ease-out disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mark active:scale-[0.96]",
  {
    variants: {
      variant: {
        primary: "bg-mark text-mark-fg hover:bg-mark-hover",
        // Reserved for a small set of high-confidence moments (landing hero
        // CTA, onboarding submit) - never a default/site-wide swap.
        "primary-strong": "bg-mark-strong text-mark-fg hover:bg-mark-hover",
        secondary: "bg-raised text-ink shadow-border hover:shadow-border-hover",
        ghost: "text-ink-2 hover:bg-paper-2 hover:text-ink",
        inverse: "text-sidebar-fg hover:bg-sidebar-fg/10 hover:text-sidebar-fg",
        danger: "bg-danger text-paper hover:opacity-90",
        warn: "bg-warn-bg text-warn shadow-border hover:shadow-border-hover",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-11 min-h-11 px-4",
        lg: "h-11 px-5",
        icon: "size-10",
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
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
