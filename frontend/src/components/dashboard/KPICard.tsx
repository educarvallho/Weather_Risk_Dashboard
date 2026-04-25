import { ReactNode } from "react";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  color?: "teal" | "red" | "yellow" | "blue";
}

const COLORS = {
  teal: "bg-teal-50 text-teal-600",
  red: "bg-red-50 text-red-600",
  yellow: "bg-yellow-50 text-yellow-600",
  blue: "bg-blue-50 text-blue-600",
};

export function KPICard({ title, value, subtitle, icon, color = "teal" }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${COLORS[color]}`}>{icon}</div>
      </div>
    </div>
  );
}
