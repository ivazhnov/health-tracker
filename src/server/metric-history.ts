export type MetricPoint = {
  specimen: string | null;
  observationId: number;
  collectedAt: string;
  valueNumeric: number | null;
  valueText: string;
  comparator: "<" | "<=" | ">" | ">=" | null;
  unit: string | null;
  referenceLow: number | null;
  referenceHigh: number | null;
  referenceText: string | null;
};

export type ProfileMetric = {
  id: number;
  key: string;
  displayName: string;
  category: string;
  defaultUnit: string | null;
  observationCount: number;
  latest: MetricPoint;
  favoriteOrder: number | null;
  points: MetricPoint[];
};

export type ProfileArchiveStats = {
  labSessionCount: number;
  observationCount: number;
  documentCount: number;
};

export type ObservationSource = {
  documentId: number;
  fileName: string;
  note: string;
};

export type MetricHistoryObservation = MetricPoint & {
  labSessionId: number;
  laboratoryName: string | null;
  specimen: string | null;
  note: string;
  sources: ObservationSource[];
};

export type MetricHistory = {
  metric: Pick<
    ProfileMetric,
    "id" | "key" | "displayName" | "category" | "defaultUnit"
  >;
  observations: MetricHistoryObservation[];
};

export interface MetricHistoryQueryRepository {
  getArchiveStats(profileId: number): ProfileArchiveStats;
  listProfileMetrics(profileId: number): ProfileMetric[];
  getMetricHistory(profileId: number, metricId: number): MetricHistory | null;
}

export interface FavoriteMetricCommandRepository {
  add(profileId: number, metricId: number): boolean;
  remove(profileId: number, metricId: number): void;
  move(profileId: number, metricId: number, direction: "up" | "down"): void;
}
