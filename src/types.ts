/**
 * Схема данных карты гипотез (см. openspec/changes/add-web-app/specs/map-model).
 * Унаследована от прежнего map.yaml без изменения смысла.
 */

export type Level = 'low' | 'medium' | 'high';
export type HypothesisStatus = 'draft' | 'to-verify' | 'confirmed' | 'refuted';

export interface MapMeta {
  title: string;
  horizon?: string;
  version?: number;
  date?: string;
}

export interface Metric {
  id: string;
  description: string;
  current: string;
  target: string;
  /** Балансирующая метрика — не даёт ухудшить другое ради основной. */
  balancing?: boolean;
}

export interface Goal {
  id: string;
  description: string;
  metrics: Metric[];
}

export interface Subject {
  id: string;
  description: string;
  influence: Level;
  pains?: string[];
  wishes?: string[];
  /** Негативный субъект — тот, кто препятствует достижению цели. */
  negative?: boolean;
}

/** Формат «Если—то—потому что—тогда». */
export interface Hypothesis {
  id: string;
  subject: string;
  metrics: string[];
  influence: Level;
  cost: Level;
  status: HypothesisStatus;
  if: string;
  then: string;
  because: string;
  so: string;
}

export interface Task {
  id: string;
  hypothesis: string;
  description: string;
  owner?: string;
  due?: string;
}

export interface Blocker {
  id: string;
  blocks: string;
  reason: string;
  action?: string;
  owner?: string;
  due?: string;
}

export interface HypothesisMap {
  schemaVersion: 1;
  meta: MapMeta;
  goal: Goal;
  subjects: Subject[];
  hypotheses: Hypothesis[];
  tasks: Task[];
  blockers: Blocker[];
}
