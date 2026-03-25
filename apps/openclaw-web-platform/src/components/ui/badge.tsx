import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "border-transparent bg-blue-600 text-white hover:bg-blue-700": variant === "default",
          "border-transparent bg-slate-800 text-slate-100 hover:bg-slate-700": variant === "secondary",
          "border-transparent bg-red-900/50 text-red-200 hover:bg-red-900/80": variant === "destructive",
          "border-slate-700 text-slate-300": variant === "outline",
          "border-transparent bg-emerald-900/50 text-emerald-200 hover:bg-emerald-900/80": variant === "success",
          "border-transparent bg-amber-900/50 text-amber-200 hover:bg-amber-900/80": variant === "warning",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
