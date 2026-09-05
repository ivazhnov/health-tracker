export type MetricDefinitionOption = {
  id: number;
  key: string;
  displayName: string;
  category: string;
  defaultUnit: string | null;
};

export type ConfirmationObservationInput = {
  valueKind?: string;
  metricDefinitionId: string;
  originalName: string;
  valueText: string;
  unit: string;
  referenceLow: string;
  referenceHigh: string;
  referenceText: string;
  sourceText: string;
};

export type ConfirmImportInput = {
  importSessionId: number;
  collectedAt: string;
  laboratoryName: string;
  note: string;
  observations: ConfirmationObservationInput[];
  conflictResolutions?: ConflictResolutionInput[];
  duplicateResolutions?: { metricDefinitionId: string; rowIndex: string }[];
};

export type ConflictResolutionInput = {
  metricDefinitionId: string;
  choice: string;
};

export type ConflictChoice = "existing" | "incoming";

export type ValidatedObservation = {
  metricDefinitionId: number;
  originalName: string;
  valueText: string;
  valueNumeric: number | null;
  documentAlternatives?: ValidatedObservation[];
  comparator: "<" | "<=" | ">" | ">=" | null;
  unit: string | null;
  referenceLow: number | null;
  referenceHigh: number | null;
  referenceText: string | null;
  sourceText: string;
};

export type ValidatedConfirmation = {
  importSessionId: number;
  collectedAt: string;
  laboratoryName: string | null;
  note: string;
  observations: ValidatedObservation[];
  conflictResolutions: Map<number, ConflictChoice>;
};

export type ConflictValue = {
  valueText: string;
  unit: string | null;
};

export type DeduplicationConflict = {
  metricDefinitionId: number;
  displayName: string;
  existing: ConflictValue;
  incoming: ConflictValue;
};

export type ConfirmationSummary = {
  outcome: "created" | "merged";
  addedObservations: number;
  matchedObservations: number;
  resolvedConflicts: number;
};

export type ConfirmationWriteResult =
  | {
      status: "confirmed" | "already_confirmed";
      labSessionId: number;
      summary: ConfirmationSummary;
    }
  | { status: "conflicts"; conflicts: DeduplicationConflict[] }
  | { status: "not_reviewable" };

export type ConfirmImportResult =
  | {
      ok: true;
      labSessionId: number;
      alreadyConfirmed: boolean;
      summary: ConfirmationSummary;
    }
  | { ok: false; error: string; conflicts?: DeduplicationConflict[] };

export type ConfirmedObservation = ValidatedObservation & {
  id: number;
  displayName: string;
  category: string;
  specimen: string | null;
  specimenCode: string;
  sourceSpecimenText: string | null;
  sourceCount: number;
};

export type ConfirmedSourceDocument = {
  sourceDocumentId: number;
  originalFileName: string;
  laboratoryName: string | null;
  specimen: string | null;
  note: string;
};

export type ConfirmedLabSession = {
  id: number;
  importSessionId: number;
  collectedAt: string;
  laboratoryName: string | null;
  specimen: string | null;
  note: string;
  confirmedAt: string;
  observations: ConfirmedObservation[];
  sources: ConfirmedSourceDocument[];
  summary: ConfirmationSummary;
};

export interface ConfirmationRepository {
  listMetricDefinitions(): MetricDefinitionOption[];
  confirm(input: ValidatedConfirmation): ConfirmationWriteResult;
  getConfirmed(importSessionId: number): ConfirmedLabSession | null;
}
