import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { cn } from "../lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

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
  return (
    <Card className={cn("bg-white border-[#E5E5E5]", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">
          {title}
        </CardTitle>
        {icon && <div className="text-gray-400">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-[#333333]">{value}</div>
        {subValue && (
          <div className="flex items-center mt-1 text-xl text-gray-500">
            {trend === "up" && (
              <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
            )}
            {trend === "down" && (
              <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
            )}
            {subValue}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
