import { Slot } from "@radix-ui/react-slot"
import { type VariantProps, cva } from "class-variance-authority"
import type { ComponentProps } from "react"
import { cn } from "../lib/cn"

const buttonVariants = cva(
  cn(
    "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md",
    "text-xs font-medium transition-colors duration-instant ease-out",
    "disabled:pointer-events-none disabled:opacity-40"
  ),
  {
    variants: {
      variant: {
        quiet: "bg-panel text-ink-muted hover:bg-panel-hover hover:text-ink active:bg-panel-active",
        accent: "bg-accent text-canvas hover:brightness-110 active:brightness-95",
        bare: "text-ink-dim hover:bg-panel-hover hover:text-ink active:bg-panel-active"
      },
      size: {
        sm: "h-6 px-2",
        md: "h-7 px-2.5"
      }
    },
    defaultVariants: {
      variant: "quiet",
      size: "sm"
    }
  }
)

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    readonly asChild?: boolean
  }

export const Button = ({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) => {
  const Component = asChild ? Slot : "button"
  return <Component className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
