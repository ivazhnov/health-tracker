export type RecognitionJob = {
  importSessionId: number;
  sourceDocumentId: number;
  storagePath: string;
  mediaType: string;
  laboratoryNameOverride: string | null;
};

export type MetricAlias = {
  metricDefinitionId: number;
  metricKey: string;
  displayName: string;
  category: string;
  defaultUnit: string | null;
  language: string;
  alias: string;
};

export type ObservationDraft = {
  metricDefinitionId: number | null;
  originalName: string;
  displayName: string | null;
  category: string | null;
  valueText: string;
  unit: string | null;
  referenceLow: string | null;
  referenceHigh: string | null;
  referenceText: string | null;
  confidence: number;
  sourceText: string;
};

export type RecognitionDraft = {
  recognitionVersion: string;
  extractedText: string;
  detectedLanguage: string;
  laboratoryName: string | null;
  collectedAt: string | null;
  specimen: string | null;
  warnings: string[];
  observations: ObservationDraft[];
};

export type StoredRecognitionDraft = RecognitionDraft & {
  importSessionId: number;
};

export interface RecognitionRepository {
  claim(importSessionId: number): RecognitionJob | null;
  listMetricAliases(): MetricAlias[];
  complete(importSessionId: number, draft: RecognitionDraft): void;
  fail(importSessionId: number, message: string): void;
  getDraft(importSessionId: number): StoredRecognitionDraft | null;
}

export interface TextExtractor {
  extract(mediaType: string, contents: Uint8Array): Promise<string>;
}

export interface DraftExtractor {
  extract(
    text: string,
    aliases: MetricAlias[],
  ): RecognitionDraft | Promise<RecognitionDraft>;
}
