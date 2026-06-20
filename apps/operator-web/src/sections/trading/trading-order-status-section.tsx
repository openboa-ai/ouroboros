import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  OperatorActionRow,
  OperatorPanel,
  OperatorSectionHeader,
  OperatorSectionStack,
  OperatorStatGrid
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
      <OperatorSectionStack>
        <OperatorStatGrid stats={stats} />
        {typeof progressValue === "number" && (
          <Progress value={progressValue} aria-label="Fill progress" />
        )}
        <OperatorActionRow>
          {chainBadges.map((badge) => (
            <Badge key={badge.label} variant={badge.variant}>
              {badge.label}
            </Badge>
          ))}
        </OperatorActionRow>
      </OperatorSectionStack>
    </OperatorPanel>
  );
}
