import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from "@/components/ui/chart";
import {
  OperatorEvidenceRow,
  OperatorField,
  OperatorFieldGrid,
  OperatorSectionStack
} from "@/design-system";

export interface TradingMarketChartField {
  label: string;
  value: string;
}

export interface TradingMarketChartPoint {
  label: string;
  price: number;
}

export interface TradingMarketChartProps {
  fields: TradingMarketChartField[];
  points: TradingMarketChartPoint[];
  instrumentLabel: string;
  footerDetail: string;
}

const chartConfig = {
  price: {
    label: "Public market price",
    color: "var(--chart-1)"
  }
} satisfies ChartConfig;

export function TradingMarketChart({
  fields,
  points,
  instrumentLabel,
  footerDetail
}: TradingMarketChartProps) {
  if (points.length === 0) {
    return (
      <OperatorFieldGrid>
        {fields.map((field) => (
          <OperatorField key={field.label} label={field.label} value={field.value} />
        ))}
      </OperatorFieldGrid>
    );
  }

  const yDomain = marketChartDomain(points);

  return (
    <OperatorSectionStack>
      <OperatorEvidenceRow className="md:grid-cols-4" aria-label="Market data provenance">
        {fields.map((field) => (
          <OperatorField key={field.label} label={field.label} value={field.value} />
        ))}
      </OperatorEvidenceRow>
      <ChartContainer
        config={chartConfig}
        className="aspect-[16/5] min-h-[180px] w-full rounded-lg bg-muted/60 p-3"
        role="img"
        aria-label="BTCUSDT public market snapshot"
      >
        <AreaChart
          accessibilityLayer
          data={points}
          margin={{ top: 12, right: 22, bottom: 8, left: 22 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={12}
            padding={{ left: 16, right: 16 }}
          />
          <YAxis hide domain={yDomain} />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="line" hideLabel />}
          />
          <Area
            dataKey="price"
            type="linear"
            fill="var(--color-price)"
            fillOpacity={0.18}
            stroke="var(--color-price)"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <strong className="min-w-0 break-words font-medium text-foreground [overflow-wrap:anywhere]">
          {instrumentLabel}
        </strong>
        <span className="min-w-0 break-words [overflow-wrap:anywhere]">{footerDetail}</span>
      </div>
    </OperatorSectionStack>
  );
}

function marketChartDomain(points: TradingMarketChartPoint[]): [number, number] {
  const values = points.map((point) => point.price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = Math.max(range * 0.12, 1);
  return [min - padding, max + padding];
}
