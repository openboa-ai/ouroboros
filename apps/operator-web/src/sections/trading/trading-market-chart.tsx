import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  OperatorChartCaption,
  type OperatorChartConfig,
  OperatorChartFrame,
  OperatorChartTooltip,
  OperatorChartTooltipContent,
  OperatorEvidenceFieldRow,
  OperatorField,
  OperatorFieldGrid,
  OperatorSectionStack
} from "@/design-system";
import { downsampleTradingMarketChartPoints } from "@/operator-performance";

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
} satisfies OperatorChartConfig;

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

  const chartPoints = downsampleTradingMarketChartPoints(points);
  const yDomain = marketChartDomain(chartPoints);

  return (
    <OperatorSectionStack>
      <OperatorEvidenceFieldRow fields={fields} aria-label="Market data provenance" />
      <OperatorChartFrame
        config={chartConfig}
        role="img"
        aria-label="BTCUSDT public market snapshot"
      >
        <AreaChart
          accessibilityLayer
          data={chartPoints}
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
          <OperatorChartTooltip
            cursor={false}
            content={<OperatorChartTooltipContent indicator="line" hideLabel />}
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
      </OperatorChartFrame>
      <OperatorChartCaption label={instrumentLabel} detail={footerDetail} />
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
