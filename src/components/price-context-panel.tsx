import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PricePoint } from "../lib/service-contract";
import { Card } from "./ui/card";

type PriceContextPanelProps = {
  series: PricePoint[];
};

export function PriceContextPanel({ series }: PriceContextPanelProps) {
  return (
    <Card
      title="Price Context"
      description="Dashboard-first context for BTC and ETH before the user drills into research detail."
    >
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 12, right: 18, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="btcFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#31d0aa" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#31d0aa" stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id="ethFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#67a6ff" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#67a6ff" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="label" stroke="#9eb0c7" tickLine={false} axisLine={false} />
            <YAxis stroke="#9eb0c7" tickLine={false} axisLine={false} width={62} />
            <Tooltip
              contentStyle={{
                background: "rgba(6, 11, 18, 0.94)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "18px",
                color: "#f6f8fb"
              }}
            />
            <Area
              type="monotone"
              dataKey="btc"
              stroke="#31d0aa"
              fill="url(#btcFill)"
              strokeWidth={2.2}
            />
            <Area
              type="monotone"
              dataKey="eth"
              stroke="#67a6ff"
              fill="url(#ethFill)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
