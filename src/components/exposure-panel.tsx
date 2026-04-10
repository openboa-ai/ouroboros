import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ExposurePoint } from "../lib/service-contract";
import { Card } from "./ui/card";

type ExposurePanelProps = {
  series: ExposurePoint[];
};

export function ExposurePanel({ series }: ExposurePanelProps) {
  return (
    <Card
      title="Symbol Exposure"
      description="Live dashboard view of the portfolio-level strategy package acting independently across BTC and ETH."
    >
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <XAxis dataKey="symbol" stroke="#9eb0c7" tickLine={false} axisLine={false} />
            <YAxis stroke="#9eb0c7" tickLine={false} axisLine={false} width={42} />
            <Tooltip
              formatter={(value: number) => [`${value}%`, "Exposure"]}
              contentStyle={{
                background: "rgba(6, 11, 18, 0.94)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "18px",
                color: "#f6f8fb"
              }}
            />
            <Bar dataKey="value" fill="#31d0aa" radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
