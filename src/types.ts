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
  /** Дополнительные цели (многоцелевая карта): 'top' — ещё одна цель верхнего уровня, 'sub' — цель уровнем ниже. */
  level?: 'top' | 'sub';
  /** Для цели уровнем ниже: задача верхней карты, которая её породила. */
  parentTask?: string;
}

export interface SeparatedMetric extends Metric {
  /** Расширенная топология: метрика отдельной карточкой — к какой цели относится. */
  goalRef: string;
}

export interface Subject {
  id: string;
  description: string;
  influence: Level;
  pains?: string[];
  wishes?: string[];
  /** Негативный субъект — тот, кто препятствует достижению цели. */
  negative?: boolean;
  /** Цели, на которые влияет субъект (многоцелевая карта); по умолчанию — главная. */
  goals?: string[];
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
  /** Многоуровневая карта: крупная задача связана с целью уровнем ниже. */
  goalRef?: string;
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
  /** Дополнительные цели: верхнего уровня ('top') и уровнем ниже ('sub'). */
  goals?: Goal[];
  /** Метрики отдельными карточками (расширенная топология). */
  metrics?: SeparatedMetric[];
  subjects: Subject[];
  hypotheses: Hypothesis[];
  tasks: Task[];
  blockers: Blocker[];
}
