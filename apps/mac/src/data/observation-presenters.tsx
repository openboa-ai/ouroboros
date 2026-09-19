import { Clock3, AlertCircle, Shield, ArrowRight } from "lucide-react";
import { Button } from "@/ui/primitives/button";
import type { Scenario } from "@/app/contracts";
// UX: ../../../../docs/design/UI_PURPOSE_CONTRACT.md#shared-states
export function Observation({
  scenario,
  onSource,
}: {
  scenario: Scenario;
  onSource?: () => void;
}) {
  const label =
    scenario === "empty"
      ? "No account observations"
      : scenario === "delayed"
        ? "Last observed 18:12 KST"
        : scenario === "restricted"
          ? "Account access restricted"
          : "Observed 20:50 KST";
  return (
    <Button variant="ghost" className="source-link" onClick={onSource}>
      <Clock3 size={12} />
      <span className="type-meta">{label}</span>
    </Button>
  );
}
export function StateNotice({
  scenario,
  openConnections,
}: {
  scenario: Scenario;
  openConnections: () => void;
}) {
  if (
    scenario !== "delayed" &&
    scenario !== "uncertain" &&
    scenario !== "restricted"
  )
    return null;
  const restricted = scenario === "restricted";
  return (
    <div className="state-notice" role="status">
      {restricted ? <Shield size={16} /> : <AlertCircle size={16} />}
      <div>
        <span className="type-control">
          {restricted
            ? "Account access restricted"
            : scenario === "delayed"
              ? "Account observations are delayed"
              : "Order outcome needs reconciliation"}
        </span>
        <p className="type-meta">
          {restricted
            ? "Account values are unavailable. Company records remain accessible."
            : scenario === "delayed"
              ? "Showing the last account snapshot from 18:12 KST."
              : "The cancellation was requested. Remaining quantity is not confirmed."}
        </p>
      </div>
      <Button variant="ghost" onClick={openConnections}>
        {scenario === "uncertain" ? "View order" : "View connection"}
        <ArrowRight size={14} />
      </Button>
    </div>
  );
}
