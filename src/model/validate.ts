import type { HypothesisMap, Level, HypothesisStatus, MotivationKind } from '../types';

/**
 * Правила целостности карты по стандарту 1.2 (см. docs/knowledge-base и
 * openspec/changes/add-web-app/specs/map-validation).
 * Топология: Задача → Гипотеза → (Субъект | Боль/Желание → Субъект | Цель-бессубъектно),
 * Субъект → Цель, Метрика → Цель, Блокер → Задача. Иные связи запрещены.
 * Возвращает список всех нарушений сразу; пустой список — карта валидна.
 */

const LEVELS: readonly Level[] = ['low', 'medium', 'high'];
const STATUSES: readonly HypothesisStatus[] = ['draft', 'to-verify', 'confirmed', 'refuted'];
const MOTIVATION_KINDS: readonly MotivationKind[] = ['pain', 'wish'];

const PART_NAMES: Record<'if' | 'then' | 'because' | 'so', string> = {
  if: 'Если',
  then: 'то',
  because: 'потому что',
  so: 'тогда',
};

type Entity = Record<string, unknown>;
/** Тип сущности по id — для проверки, что ссылка ведёт на допустимый тип. */
type Kind = 'цель' | 'метрика' | 'субъект' | 'мотивация' | 'гипотеза' | 'задача' | 'блокер';

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

  const extraGoals = Array.isArray(map.goals) ? (map.goals as unknown as Entity[]) : [];
  const metricList = [goal, ...extraGoals].flatMap((g) =>
    Array.isArray(g['metrics']) ? (g['metrics'] as unknown as Entity[]) : [],
  );
  const separatedMetrics = Array.isArray(map.metrics)
    ? (map.metrics as unknown as Entity[])
    : [];
  const subjects = Array.isArray(map.subjects) ? (map.subjects as unknown as Entity[]) : [];
  const motivations = Array.isArray(map.motivations)
    ? (map.motivations as unknown as Entity[])
    : [];
  const hypotheses = Array.isArray(map.hypotheses)
    ? (map.hypotheses as unknown as Entity[])
    : [];
  const tasks = Array.isArray(map.tasks) ? (map.tasks as unknown as Entity[]) : [];
  const blockers = Array.isArray(map.blockers) ? (map.blockers as unknown as Entity[]) : [];

  // --- уникальность и типизация id ---
  const seen = new Map<string, Kind>();
  const checkUnique = (kind: Kind, items: Entity[]): void => {
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
  checkUnique('цель', extraGoals);
  checkUnique('метрика', metricList);
  checkUnique('метрика', separatedMetrics);
  checkUnique('субъект', subjects);
  checkUnique('мотивация', motivations);
  checkUnique('гипотеза', hypotheses);
  checkUnique('задача', tasks);
  checkUnique('блокер', blockers);

  /** Ссылка обязана существовать И вести на допустимый тип сущности. */
  const link = (id: unknown, what: string, allowed: readonly Kind[]): boolean => {
    if (!isStr(id) || id === '') {
      errors.push(`${what}: пустая ссылка`);
      return false;
    }
    const kind = seen.get(id);
    if (kind === undefined) {
      errors.push(`${what}: ссылка на несуществующий id '${id}'`);
      return false;
    }
    if (!allowed.includes(kind)) {
      errors.push(
        `${what}: ссылка на '${id}' указывает на сущность типа '${kind}', а допускается только ${allowed.join(' / ')}`,
      );
      return false;
    }
    return true;
  };

  // --- цели: убранные поля старой схемы ---
  for (const g of [goal, ...extraGoals]) {
    const gid = isStr(g['id']) ? g['id'] : '?';
    for (const legacy of ['level', 'parentTask'] as const) {
      if (g[legacy] !== undefined) {
        errors.push(
          `цель '${gid}': поле '${legacy}' удалено — связь задача→цель запрещена стандартом; масштабная задача раскрывается отдельной картой (task.childMapId)`,
        );
      }
    }
    for (const m of (Array.isArray(g['metrics']) ? g['metrics'] : []) as Entity[]) {
      const mid = isStr(m['id']) ? m['id'] : '?';
      for (const field of ['current', 'target'] as const) {
        const value = m[field];
        if (typeof value !== 'string' || value === '') {
          errors.push(`метрика '${mid}': пустое поле '${field}'`);
        }
      }
    }
  }

  // --- отдельные метрики: метрика → цель ---
  for (const m of separatedMetrics) {
    const mid = isStr(m['id']) ? m['id'] : '?';
    for (const field of ['current', 'target'] as const) {
      const value = m[field];
      if (typeof value !== 'string' || value === '') {
        errors.push(`метрика '${mid}': пустое поле '${field}'`);
      }
    }
    link(m['goalRef'], `метрика '${mid}' (goalRef)`, ['цель']);
    if (!LEVELS.includes(m['influence'] as Level)) {
      errors.push(
        `метрика '${mid}': недопустимое влияние '${String(m['influence'])}' относительно цели (${LEVELS.join('|')})`,
      );
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
    const goalRefs = s['goals'];
    if (goalRefs !== undefined && !isStrArray(goalRefs)) {
      errors.push(`субъект '${sid}': 'goals' должен быть списком id целей`);
    } else if (isStrArray(goalRefs)) {
      for (const gid of goalRefs) link(gid, `субъект '${sid}' (цель)`, ['цель']);
    }
  }

  // --- боли/желания: мотивация → субъект ---
  for (const mo of motivations) {
    const moid = isStr(mo['id']) ? mo['id'] : '?';
    if (!MOTIVATION_KINDS.includes(mo['kind'] as MotivationKind)) {
      errors.push(
        `боль/желание '${moid}': недопустимый kind '${String(mo['kind'])}' (pain|wish)`,
      );
    }
    link(mo['subject'], `боль/желание '${moid}' (subject)`, ['субъект']);
    if (!LEVELS.includes(mo['influence'] as Level)) {
      errors.push(
        `боль/желание '${moid}': недопустимое влияние '${String(mo['influence'])}' относительно субъекта (${LEVELS.join('|')})`,
      );
    }
    if (!isStr(mo['description']) || mo['description'].trim() === '') {
      errors.push(`боль/желание '${moid}': пустое описание`);
    }
  }

  // --- гипотезы: Если—то—потому что—тогда; цель воздействия — субъект/мотивация/цель ---
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
    if (h['subject'] !== undefined) {
      errors.push(
        `гипотеза '${hid}': поле 'subject' переименовано в 'target' (субъект, его боль/желание или цель для бессубъектного контура)`,
      );
    }
    link(
      h['target'],
      `гипотеза '${hid}' (target)`,
      ['субъект', 'мотивация', 'цель'],
    );
    const hypMetrics = h['metrics'];
    if (!isStrArray(hypMetrics) || hypMetrics.length === 0) {
      errors.push(`гипотеза '${hid}': не указана ни одна метрика влияния`);
    } else {
      for (const mid of hypMetrics) link(mid, `гипотеза '${hid}' (метрика)`, ['метрика']);
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

  // --- задачи: ТОЛЬКО задача → гипотеза ---
  for (const t of tasks) {
    const tid = isStr(t['id']) ? t['id'] : '?';
    if (t['goalRef'] !== undefined) {
      errors.push(
        `задача '${tid}': связь задача→цель запрещена — задачи ведут только на гипотезы; масштабная задача раскрывается отдельной картой (childMapId), а не стрелкой`,
      );
    }
    link(t['hypothesis'], `задача '${tid}'`, ['гипотеза']);
  }

  // --- блокеры ---
  for (const b of blockers) {
    const bid = isStr(b['id']) ? b['id'] : '?';
    link(b['blocks'], `блокер '${bid}'`, ['задача']);
    if (!isStr(b['reason']) || b['reason'].trim() === '') {
      errors.push(`блокер '${bid}': не указана причина (поле 'reason')`);
    }
  }

  return errors;
}
