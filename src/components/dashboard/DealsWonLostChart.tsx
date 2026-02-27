"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DealsWonLostChartProps {
  data: { month: string; won: number; lost: number }[];
}

const EMPTY_DATA = [
  { month: "Jan", won: 0, lost: 0 },
  { month: "Fev", won: 0, lost: 0 },
  { month: "Mar", won: 0, lost: 0 },
  { month: "Avr", won: 0, lost: 0 },
  { month: "Mai", won: 0, lost: 0 },
  { month: "Jun", won: 0, lost: 0 },
];

export function DealsWonLostChart({ data }: DealsWonLostChartProps) {
  const chartData = data.length > 0 ? data : EMPTY_DATA;
  const isEmpty = data.length === 0 || data.every((d) => d.won === 0 && d.lost === 0);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Deals gagnes vs perdus</CardTitle>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
            Aucun deal pour le moment. Les donnees apparaitront ici.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              />
              <Legend />
              <Bar
                dataKey="won"
                name="Gagnes"
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="lost"
                name="Perdus"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
