import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        green: "border-transparent bg-[#EAF3DE] text-[#27500A] dark:bg-[#1b3a0d] dark:text-[#7ec44a]",
        red: "border-transparent bg-[#FCEBEB] text-[#791F1F] dark:bg-[#2e1010] dark:text-[#d06868]",
        neutral: "border-transparent bg-[#F1EFE8] text-[#444] dark:bg-[#26252a] dark:text-[#aaa]",
        blue: "border-transparent bg-[#E6F1FB] text-[#0C447C] dark:bg-[#0c1f35] dark:text-[#5aaada]",
        orange: "border-transparent bg-[#FAECE7] text-[#712B13] dark:bg-[#2c1608] dark:text-[#d08050]",
        rival: "border-transparent bg-[#FAECE7] text-[#993C1D] dark:bg-[#2c1608] dark:text-[#d07040]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
