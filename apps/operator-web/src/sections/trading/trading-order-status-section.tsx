import type { ComponentProps } from "react";
import { Progress } from "@/components/ui/progress";
import {
  OperatorActionRow,
  OperatorPanel,
  OperatorSectionHeader,
  OperatorSectionStack,
  OperatorStatGrid,
  OperatorStatusBadge
} from "@/design-system";

export interface TradingOrderStatusBadge {
  label: string;
  variant: ComponentProps<typeof OperatorStatusBadge>["variant"];
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
        actions={<OperatorStatusBadge value={statusBadge.label} variant={statusBadge.variant} />}
      />
      <OperatorSectionStack>
        <OperatorStatGrid stats={stats} />
        {typeof progressValue === "number" && (
          <Progress value={progressValue} aria-label="Fill progress" />
        )}
        <OperatorActionRow>
          {chainBadges.map((badge) => (
            <OperatorStatusBadge key={badge.label} value={badge.label} variant={badge.variant} />
          ))}
        </OperatorActionRow>
      </OperatorSectionStack>
    </OperatorPanel>
  );
}
