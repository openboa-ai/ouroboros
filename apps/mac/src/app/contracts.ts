// UX: ../../../../docs/design/UI_PURPOSE_CONTRACT.md#coverage
// Local preview references only. These are not Gateway commands or company ledger records.
export type Destination = string;
export type Scenario = "observed" | "delayed" | "uncertain" | "restricted" | "empty";
/** Opaque, namespaced navigation reference. Business-specific fields belong to modules. */
export interface DetailTarget {
  module?: string;
  kind: string;
  id?: string;
  revision?: number;
  tab?: string;
  query?: string;
  [parameter: string]: unknown;
}
export interface ContextReference {
  label: string;
  target: DetailTarget;
}
export interface ViewProps {
  updateDetail?: (patch: Partial<DetailTarget>) => void;
  open: (target: DetailTarget) => void;
  discuss: (context: ContextReference) => void;
  scenario: Scenario;
}
export interface InspectorProps extends ViewProps {
  target: DetailTarget;
}
