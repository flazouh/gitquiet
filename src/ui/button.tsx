import { Slot } from "@radix-ui/react-slot"
import { type VariantProps, cva } from "class-variance-authority"
import type { ComponentProps } from "react"
import { cn } from "../lib/cn"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-neutral-900 text-neutral-50 hover:bg-neutral-800",
        outline: "border border-neutral-300 bg-transparent hover:bg-neutral-100"
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
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
