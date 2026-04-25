"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface DataPoint {
  city_id: number;
  city_name: string;
  temperature: number;
}

export function TemperatureChart({ data }: { data: DataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="city_name" tick={{ fontSize: 11 }} tickFormatter={(v) => v.split(" ")[0]} />
        <YAxis tick={{ fontSize: 11 }} unit="°C" />
        <Tooltip
          formatter={(v: number) => [`${v}°C`, "Temperatura"]}
          labelStyle={{ fontWeight: 600 }}
        />
        <Bar dataKey="temperature" fill="#14b8a6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
