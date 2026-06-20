import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  OPERATOR_DESIGN_TOKENS,
  OperatorPanel,
  OperatorSectionHeader,
  OperatorStat
} from "@/design-system";

export interface TradingOrderStatusBadge {
  label: string;
  variant: ComponentProps<typeof Badge>["variant"];
}

export interface TradingOrderStatusStat {
  label: string;
  value: string;
}

export function TradingOrderStatusSection({
  statusBadge,
  stats,
  progressValue,
  chainBadges
}: {
  statusBadge: TradingOrderStatusBadge;
  stats: TradingOrderStatusStat[];
  progressValue?: number;
  chainBadges: TradingOrderStatusBadge[];
}) {
  return (
    <OperatorPanel aria-label="Trade status">
      <OperatorSectionHeader
        title="Order / trade status"
        description="What the current system attempted and what happened."
        actions={<Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>}
      />
      <div className={OPERATOR_DESIGN_TOKENS.layout.section}>
        <div className={OPERATOR_DESIGN_TOKENS.layout.statGrid}>
          {stats.map((stat) => (
            <OperatorStat key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>
        {typeof progressValue === "number" && (
          <Progress value={progressValue} aria-label="Fill progress" />
        )}
        <div className={OPERATOR_DESIGN_TOKENS.layout.actionRow}>
          {chainBadges.map((badge) => (
            <Badge key={badge.label} variant={badge.variant}>
              {badge.label}
            </Badge>
          ))}
        </div>
      </div>
    </OperatorPanel>
  );
}
