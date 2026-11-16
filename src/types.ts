/**
 * Схема данных карты гипотез (см. openspec/changes/add-web-app/specs/map-model).
 * Правила методологии — docs/knowledge-base/.../standard-1.2.md.
 * Каноническая топология: Задача → Гипотеза → Субъект → Цель;
 * допустим бессубъектный контур Задача → Гипотеза → Цель.
 */

export type Level = 'low' | 'medium' | 'high';
export type HypothesisStatus = 'draft' | 'to-verify' | 'confirmed' | 'refuted';
export type MotivationKind = 'pain' | 'wish';

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

export interface SeparatedMetric extends Metric {
  /** Топология «метрики на отдельном уровне»: к какой цели относится метрика. */
  goalRef: string;
  /** Влияние метрики относительно цели. */
  influence: Level;
}

/** Топология «мотивация на отдельном уровне»: боль или желание субъекта
 * отдельной карточкой; гипотезы бьют в конкретную мотивацию,
 * мотивация влияет на субъекта. */
export interface Motivation {
  id: string;
  kind: MotivationKind;
  description: string;
  subject: string;
  /** Влияние мотивации относительно субъекта. */
  influence: Level;
}

export interface Subject {
  id: string;
  description: string;
  influence: Level;
  /** Классическая топология: мотивация текстом внутри карточки субъекта. */
  pains?: string[];
  wishes?: string[];
  /** Негативный субъект — намеренно мешает достижению цели. */
  negative?: boolean;
  /** Цели, на которые влияет субъект (многоцелевая карта); по умолчанию — главная. */
  goals?: string[];
  /** Вынесенные метрики СВОИХ целей, на которые влияет субъект (топология
   *  «метрики на отдельном уровне»): цель с вынесенными метриками принимает
   *  связи только через них — даже если метрика одна. */
  metrics?: string[];
}

/** Формат «Если—то—потому что—тогда». */
export interface Hypothesis {
  id: string;
  /** Цель воздействия гипотезы: субъект, его боль/желание (если у субъекта
   *  вынесена мотивация — только через неё), метрика (если у цели вынесены
   *  метрики — только через них) или цель без вынесенных метрик
   *  (бессубъектный контур). */
  target: string;
  /** Структурная связь с метриками цели — тегом в модели, стрелкой не рисуется. */
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
  /** Многоуровневая карта: id дочерней карты, раскрывающей эту задачу.
   * Структурная связь, стрелкой не рисуется. */
  childMapId?: string;
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
  /** Дополнительные цели верхнего уровня (многоцелевая карта). */
  goals?: Goal[];
  /** Метрики отдельными карточками (топология «метрики на отдельном уровне»). */
  metrics?: SeparatedMetric[];
  subjects: Subject[];
  /** Боли и желания отдельными карточками (топология «мотивация на отдельном уровне»). */
  motivations?: Motivation[];
  hypotheses: Hypothesis[];
  tasks: Task[];
  blockers: Blocker[];
}
