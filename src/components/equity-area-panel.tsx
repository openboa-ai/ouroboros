import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EquityPoint } from "../lib/service-contract";
import { Card } from "./ui/card";

type EquityAreaPanelProps = {
  series: EquityPoint[];
};

export function EquityAreaPanel({ series }: EquityAreaPanelProps) {
  return (
    <Card
      title="Net PnL Curve"
      description="Live-centered equity tracking including trading cost and model spend assumptions."
    >
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 12, right: 18, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f2b84b" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#f2b84b" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="label" stroke="#9eb0c7" tickLine={false} axisLine={false} />
            <YAxis stroke="#9eb0c7" tickLine={false} axisLine={false} width={62} />
            <Tooltip
              formatter={(value: number) => [`$${value.toLocaleString()}`, "Net PnL"]}
              contentStyle={{
                background: "rgba(6, 11, 18, 0.94)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "18px",
                color: "#f6f8fb"
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#f2b84b"
              fill="url(#equityFill)"
              strokeWidth={2.2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
