import type {
  HypothesisMap,
  Level,
  HypothesisStatus,
  MotivationKind,
  TaskStatus,
} from '../types';

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
const TASK_STATUSES: readonly TaskStatus[] = ['todo', 'in-progress', 'done'];

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

  // --- иерархия целей (topology.md №4): цель-связка из нескольких элементов ---
  const allGoalEnts = [goal, ...extraGoals];
  const parentOfGoal = new Map<string, string>();
  for (const g of allGoalEnts) {
    if (isStr(g['id']) && isStr(g['parent'])) parentOfGoal.set(g['id'], g['parent']);
  }
  /** Разложенная цель — у неё есть под-цели; прямые связи к ней запрещены. */
  const decomposed = new Set<string>(parentOfGoal.values());
  for (const g of allGoalEnts) {
    const gid = isStr(g['id']) ? g['id'] : '?';
    if (g['influence'] !== undefined && !LEVELS.includes(g['influence'] as Level)) {
      errors.push(
        `цель '${gid}': недопустимое влияние '${String(g['influence'])}' относительно родителя (${LEVELS.join('|')})`,
      );
    }
    if (g['parent'] === undefined) continue;
    if (!link(g['parent'], `цель '${gid}' (parent)`, ['цель'])) continue;
    // цикл: поднимаемся по цепочке родителей до повтора
    let cur: string | null = isStr(g['parent']) ? g['parent'] : null;
    const chain: string[] = [gid];
    while (cur && !chain.includes(cur)) {
      chain.push(cur);
      cur = parentOfGoal.get(cur) ?? null;
    }
    if (cur === gid) {
      errors.push(`цель '${gid}': цикл в иерархии целей (${chain.join(' → ')} → ${gid})`);
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
    const mGoal = isStr(m['goalRef']) ? m['goalRef'] : '';
    if (decomposed.has(mGoal)) {
      errors.push(
        `метрика '${mid}': цель '${mGoal}' разложена на под-цели — привяжите метрику к под-цели (goalRef), а не к разложенной цели`,
      );
    }
    if (!LEVELS.includes(m['influence'] as Level)) {
      errors.push(
        `метрика '${mid}': недопустимое влияние '${String(m['influence'])}' относительно цели (${LEVELS.join('|')})`,
      );
    }
  }

  // --- субъекты ---
  const mainGoalId = isStr(goal['id']) ? goal['id'] : '';
  for (const s of subjects) {
    const sid = isStr(s['id']) ? s['id'] : '?';
    if (!LEVELS.includes(s['influence'] as Level)) {
      errors.push(
        `субъект '${sid}': недопустимое значение 'influence' = '${String(s['influence'])}' (${LEVELS.join('|')})`,
      );
    }
    const goalRefs = s['goals'];
    let goalIds: string[] = [mainGoalId];
    if (goalRefs !== undefined && !isStrArray(goalRefs)) {
      errors.push(`субъект '${sid}': 'goals' должен быть списком id целей`);
    } else if (isStrArray(goalRefs)) {
      goalIds = goalRefs;
      for (const gid of goalRefs) link(gid, `субъект '${sid}' (цель)`, ['цель']);
    }
    const metricRefs = s['metrics'];
    if (metricRefs !== undefined && !isStrArray(metricRefs)) {
      errors.push(`субъект '${sid}': 'metrics' должен быть списком id метрик`);
    } else if (isStrArray(metricRefs)) {
      for (const mid of metricRefs) link(mid, `субъект '${sid}' (метрика)`, ['метрика']);
    }
    // цель с вынесенными метриками не обходится: субъект обязан влиять
    // хотя бы на одну метрику такой цели, а не на саму цель;
    // разложенная на под-цели цель не принимает субъектов вовсе
    for (const gid of goalIds) {
      if (gid === '') continue;
      if (decomposed.has(gid)) {
        errors.push(
          `субъект '${sid}': цель '${gid}' разложена на под-цели — привяжите субъект к под-целям (subject.goals), а не к разложенной цели`,
        );
        continue;
      }
      const goalMetrics = separatedMetrics
        .filter((m) => m['goalRef'] === gid)
        .map((m) => (isStr(m['id']) ? m['id'] : ''))
        .filter(Boolean);
      if (goalMetrics.length === 0) continue;
      const attached = isStrArray(metricRefs)
        ? metricRefs.filter((mid) => goalMetrics.includes(mid))
        : [];
      if (attached.length === 0) {
        errors.push(
          `субъект '${sid}': цель '${gid}' имеет вынесенные метрики (${goalMetrics.join(', ')}) — привяжите субъект к метрикам (subject.metrics), а не к цели`,
        );
      }
    }
    // метрики субъекта принадлежат только целям самого субъекта
    if (isStrArray(metricRefs)) {
      for (const mid of metricRefs) {
        const m = separatedMetrics.find((x) => x['id'] === mid);
        if (m && isStr(m['goalRef']) && !goalIds.includes(m['goalRef'])) {
          errors.push(
            `субъект '${sid}': метрика '${mid}' принадлежит цели '${m['goalRef']}', которой нет в целях субъекта`,
          );
        }
      }
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
        `гипотеза '${hid}': поле 'subject' переименовано в 'target' (субъект, его боль/желание, метрика или цель для бессубъектного контура)`,
      );
    }
    link(
      h['target'],
      `гипотеза '${hid}' (target)`,
      ['субъект', 'мотивация', 'цель', 'метрика'],
    );
    // вынесенный уровень не обходится: цель с вынесенными метриками принимает
    // связи только через свои метрики; субъект с вынесенной мотивацией —
    // только через свои боли/желания (даже если она одна)
    const targetId = isStr(h['target']) ? h['target'] : '';
    const targetKind = seen.get(targetId);
    if (targetKind === 'цель') {
      const goalMetrics = separatedMetrics
        .filter((m) => m['goalRef'] === targetId)
        .map((m) => (isStr(m['id']) ? m['id'] : ''))
        .filter(Boolean);
      if (goalMetrics.length > 0) {
        errors.push(
          `гипотеза '${hid}': цель '${targetId}' имеет вынесенные метрики (${goalMetrics.join(', ')}) — привяжите гипотезу к метрике (бессубъектный контур), а не к цели`,
        );
      }
      if (decomposed.has(targetId)) {
        errors.push(
          `гипотеза '${hid}': цель '${targetId}' разложена на под-цели — привяжите гипотезу к под-цели, а не к разложенной цели`,
        );
      }
    }
    if (targetKind === 'субъект') {
      const subjectMos = motivations
        .filter((mo) => mo['subject'] === targetId)
        .map((mo) => (isStr(mo['id']) ? mo['id'] : ''))
        .filter(Boolean);
      if (subjectMos.length > 0) {
        errors.push(
          `гипотеза '${hid}': у субъекта '${targetId}' вынесены боли/желания (${subjectMos.join(', ')}) — привяжите гипотезу к ним, а не к субъекту`,
        );
      }
    }
    // метрики влияния могут быть ещё не выбраны (карта на раннем этапе —
    // на доске плашка «Нужно заполнить»); заданные ссылки валидируются
    const hypMetrics = h['metrics'];
    if (hypMetrics !== undefined && !isStrArray(hypMetrics)) {
      errors.push(`гипотеза '${hid}': 'metrics' должен быть списком id метрик`);
    } else if (isStrArray(hypMetrics)) {
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
    if (t['group'] !== undefined && (!isStr(t['group']) || t['group'].trim() === '')) {
      errors.push(`задача '${tid}': 'group' должен быть непустым названием направления`);
    }
    if (t['status'] !== undefined && !TASK_STATUSES.includes(t['status'] as TaskStatus)) {
      errors.push(
        `задача '${tid}': недопустимый статус исполнения '${String(t['status'])}' (${TASK_STATUSES.join('|')})`,
      );
    }
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
