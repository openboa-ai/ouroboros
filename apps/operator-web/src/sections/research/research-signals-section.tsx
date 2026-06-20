import {
  OperatorPanel,
  OperatorSectionHeader,
  OperatorSectionStack,
  OperatorStat,
  OperatorStatGrid
} from "@/design-system";

export interface ResearchSignalMetric {
  label: string;
  value: string;
  detail?: string;
  className?: string;
}

export function ResearchSignalsSection({
  reviewSignal,
  metrics
}: {
  reviewSignal: ResearchSignalMetric;
  metrics: ResearchSignalMetric[];
}) {
  return (
    <OperatorPanel aria-label="Research signals">
      <OperatorSectionHeader
        title="Research signals"
        description="Research-facing quality, risk posture, and packet signal for the next candidate cycle."
      />
      <OperatorSectionStack>
        <OperatorStat
          label={reviewSignal.label}
          value={reviewSignal.value}
          detail={reviewSignal.detail}
          className={reviewSignal.className}
        />
        <OperatorStatGrid stats={metrics} aria-label="Research signal metrics" />
      </OperatorSectionStack>
    </OperatorPanel>
  );
}
