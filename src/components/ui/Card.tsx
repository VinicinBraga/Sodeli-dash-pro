import React from "react";
import { cn } from "../../lib/utils";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, children, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "bg-[#F8F8F8] rounded-lg border border-gray-100 shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: DivProps) {
  return (
    <div className={cn("p-6 pb-2", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-lg font-semibold text-gray-800 tracking-tight",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardContent({ className, children, ...props }: DivProps) {
  return (
    <div className={cn("p-6 pt-2", className)} {...props}>
      {children}
    </div>
  );
}
