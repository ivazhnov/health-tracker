export type MetricDefinitionOption = {
  id: number;
  key: string;
  displayName: string;
  category: string;
  defaultUnit: string | null;
};

export type ConfirmationObservationInput = {
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
  specimen: string;
  note: string;
  observations: ConfirmationObservationInput[];
};

export type ValidatedObservation = {
  metricDefinitionId: number;
  originalName: string;
  valueText: string;
  valueNumeric: number;
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
  specimen: string | null;
  note: string;
  observations: ValidatedObservation[];
};

export type ConfirmationWriteResult =
  | { status: "confirmed" | "already_confirmed"; labSessionId: number }
  | { status: "not_reviewable" };

export type ConfirmImportResult =
  | { ok: true; labSessionId: number; alreadyConfirmed: boolean }
  | { ok: false; error: string };

export type ConfirmedObservation = ValidatedObservation & {
  id: number;
  displayName: string;
  category: string;
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
};

export interface ConfirmationRepository {
  listMetricDefinitions(): MetricDefinitionOption[];
  confirm(input: ValidatedConfirmation): ConfirmationWriteResult;
  getConfirmed(importSessionId: number): ConfirmedLabSession | null;
}
