import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { cn } from "../lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";

interface MetricCardProps {
  title: string;
  value: string;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subValue,
  trend,
  icon,
  className,
}) => {
  const { darkMode } = useTheme();

  return (
    <Card
      className={cn(
        "border rounded-lg transition-colors",
        darkMode
          ? "bg-[#0f0f10] border-[#2a2a2a] text-gray-100"
          : "bg-white border-[#E5E5E5] text-gray-900",
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle
          className={cn(
            "text-sm font-medium uppercase tracking-wider",
            darkMode ? "text-gray-400" : "text-gray-500"
          )}
        >
          {title}
        </CardTitle>

        {icon && (
          <div className={cn(darkMode ? "text-gray-500" : "text-gray-400")}>
            {icon}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-2 min-h-[90px]">
        <div className={cn("text-2xl font-bold", darkMode && "text-[#f5f5f5]")}>
          {value}
        </div>

        {/* subValue ocupa sempre 1 linha (mesmo quando não tem) */}
        <div
          className={cn(
            "text-xl",
            darkMode ? "text-gray-400" : "text-gray-500"
          )}
        >
          {subValue ? (
            <span className="flex items-center">
              {trend === "up" && (
                <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              )}
              {trend === "down" && (
                <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
              )}
              {subValue}
            </span>
          ) : (
            <span className="invisible">placeholder</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
