import type { HypothesisMap, Level, HypothesisStatus } from '../types';

/**
 * Правила целостности карты (см. openspec/changes/add-web-app/specs/map-validation).
 * Возвращает список всех нарушений сразу; пустой список — карта валидна.
 */

const LEVELS: readonly Level[] = ['low', 'medium', 'high'];
const STATUSES: readonly HypothesisStatus[] = ['draft', 'to-verify', 'confirmed', 'refuted'];

const PART_NAMES: Record<'if' | 'then' | 'because' | 'so', string> = {
  if: 'Если',
  then: 'то',
  because: 'потому что',
  so: 'тогда',
};

type Entity = Record<string, unknown>;

const isObj = (v: unknown): v is Entity => typeof v === 'object' && v !== null;
const isStr = (v: unknown): v is string => typeof v === 'string';
const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

export function validateMap(input: unknown): string[] {
  const errors: string[] = [];
  if (!isObj(input)) {
    return ['карта: не является объектом'];
  }
  const map = input as Partial<HypothesisMap>;

  const goal = map.goal;
  if (!isObj(goal)) {
    errors.push('карта: отсутствует цель (goal)');
    return errors;
  }

  const metrics = isObj(goal.metrics) || Array.isArray(goal.metrics) ? goal.metrics : [];
  const metricList = Array.isArray(metrics) ? (metrics as unknown as Entity[]) : [];
  const subjects = Array.isArray(map.subjects)
    ? (map.subjects as unknown as Entity[])
    : [];
  const hypotheses = Array.isArray(map.hypotheses)
    ? (map.hypotheses as unknown as Entity[])
    : [];
  const tasks = Array.isArray(map.tasks) ? (map.tasks as unknown as Entity[]) : [];
  const blockers = Array.isArray(map.blockers) ? (map.blockers as unknown as Entity[]) : [];

  // --- уникальность id ---
  const seen = new Map<string, string>();
  const checkUnique = (kind: string, items: Entity[]): void => {
    for (const item of items) {
      const id = item['id'];
      if (!isStr(id) || id === '') {
        errors.push(`${kind}: отсутствует id`);
        continue;
      }
      const prev = seen.get(id);
      if (prev !== undefined) {
        errors.push(`дубликат id '${id}' (${kind} и ${prev})`);
      } else {
        seen.set(id, kind);
      }
    }
  };
  checkUnique('цель', [goal]);
  checkUnique('метрика', metricList);
  checkUnique('субъект', subjects);
  checkUnique('гипотеза', hypotheses);
  checkUnique('задача', tasks);
  checkUnique('блокер', blockers);

  const exists = (id: unknown, what: string): boolean => {
    if (isStr(id) && seen.has(id)) return true;
    errors.push(`${what}: ссылка на несуществующий id '${String(id)}'`);
    return false;
  };

  // --- метрики ---
  for (const m of metricList) {
    const mid = isStr(m['id']) ? m['id'] : '?';
    for (const field of ['current', 'target'] as const) {
      const value = m[field];
      if (typeof value !== 'string' || value === '') {
        errors.push(`метрика '${mid}': пустое поле '${field}'`);
      }
    }
  }

  // --- субъекты ---
  for (const s of subjects) {
    const sid = isStr(s['id']) ? s['id'] : '?';
    if (!LEVELS.includes(s['influence'] as Level)) {
      errors.push(
        `субъект '${sid}': недопустимое значение 'influence' = '${String(s['influence'])}' (${LEVELS.join('|')})`,
      );
    }
  }

  // --- гипотезы ---
  for (const h of hypotheses) {
    const hid = isStr(h['id']) ? h['id'] : '?';
    for (const part of ['if', 'then', 'because', 'so'] as const) {
      const value = h[part];
      if (typeof value !== 'string' || value.trim() === '') {
        errors.push(
          `гипотеза '${hid}': пустая часть формата '${PART_NAMES[part]}' (Если—то—потому что—тогда)`,
        );
      }
    }
    if (isStr(h['subject']) && h['subject'] !== '') {
      exists(h['subject'], `гипотеза '${hid}' (субъект)`);
    } else {
      errors.push(`гипотеза '${hid}': не привязана к субъекту`);
    }
    const hypMetrics = h['metrics'];
    if (!isStrArray(hypMetrics) || hypMetrics.length === 0) {
      errors.push(`гипотеза '${hid}': не указана ни одна метрика влияния`);
    } else {
      for (const mid of hypMetrics) exists(mid, `гипотеза '${hid}' (метрика)`);
    }
    if (!STATUSES.includes(h['status'] as HypothesisStatus)) {
      errors.push(
        `гипотеза '${hid}': недопустимый статус '${String(h['status'])}' (${STATUSES.join('|')})`,
      );
    }
    for (const field of ['influence', 'cost'] as const) {
      if (!LEVELS.includes(h[field] as Level)) {
        errors.push(
          `гипотеза '${hid}': недопустимое значение '${field}' = '${String(h[field])}' (${LEVELS.join('|')})`,
        );
      }
    }
  }

  // --- задачи ---
  for (const t of tasks) {
    const tid = isStr(t['id']) ? t['id'] : '?';
    if (isStr(t['hypothesis']) && t['hypothesis'] !== '') {
      exists(t['hypothesis'], `задача '${tid}'`);
    } else {
      errors.push(`задача '${tid}': не привязана к гипотезе`);
    }
  }

  // --- блокеры ---
  for (const b of blockers) {
    const bid = isStr(b['id']) ? b['id'] : '?';
    if (isStr(b['blocks']) && b['blocks'] !== '') {
      exists(b['blocks'], `блокер '${bid}'`);
    } else {
      errors.push(`блокер '${bid}': не указано, что блокируется (поле 'blocks')`);
    }
  }

  return errors;
}
