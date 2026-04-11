import type { BootstrapState } from "../lib/service-contract";

export type ApplyNextStateOptions = {
  selectedCheckpointId?: string | null;
  selectedCollectionId?: string | null;
  selectedImportId?: string | null;
  selectedOperationId?: string | null;
  selectedDocumentId?: string | null;
  selectedDocumentRef?: string | null;
  preserveDetailState?: boolean;
};

export type ApplyNextStateFn = (
  nextState: BootstrapState,
  options?: ApplyNextStateOptions
) => void;
