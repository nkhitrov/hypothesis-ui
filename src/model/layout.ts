import type { HypothesisMap, Level } from '../types';

/**
 * Раскладка карты для React Flow: позиции карточек с щедрыми отступами
 * и связи с распределением точек входа по правому краю карточки-цели.
 * Маршрутизацию стрелок выполняет React Flow.
 */

export type CardKind = 'goal' | 'metric' | 'subject' | 'hypothesis' | 'task' | 'blocker';
export type EdgeKind = 'flow' | 'block' | 'sub' | 'metric';

/** Строка карточки: жирная связка/заголовок + обычный текст. */
export interface CardRow {
  label?: string;
  text: string;
  boldText?: boolean;
  cls?: string;
}
export interface CardNode {
  id: string;
  kind: CardKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rows: CardRow[];
  /** Цифра влияния (1–3) в квадратике на левом верхнем углу. */
  priority: number | null;
  /** Цифра затрат (1–3) — квадратик на левом нижнем углу. */
  cost: number | null;
  /** Сколько связей входит в правый край карточки (для хэндлов). */
  incomingRight: number;
  extraStyle?: string;
}
export interface EdgeNode {
  from: string;
  to: string;
  kind: EdgeKind;
  level: Level | null;
  sourceHandle: string;
  targetHandle: string;
  /** Для дуг поверх доски: высота обхода над карточками. */
  topY?: number;
  /** Для отдельной метрики → цель: линия над колонкой целей. */
  metricTopY?: number;
}
export interface Layout {
  cards: CardNode[];
  edges: EdgeNode[];
}

// --- Геометрия (щедрые отступы для «воздушной» компоновки) ---
const CHAR_W = 10.4;
const LINE_H = 28;
const PAD = 24;
const TASK_PAD = 18;
const GAP_Y = 48;
const COL_GAP = 240;
const BLOCKER_GAP = 120; // блокер стоит ближе к задачам, которые блокирует
const PAGE_PAD = 60;

const COLUMN_ORDER: CardKind[] = ['goal', 'subject', 'hypothesis', 'task', 'blocker'];
const COLUMN_W: Record<CardKind, number> = {
  goal: 400,
  metric: 400, // отдельные метрики живут в колонке целей
  subject: 350,
  hypothesis: 350,
  task: 390,
  blocker: 300,
};
const MIN_H: Partial<Record<CardKind, number>> = { goal: 400, task: 96 };

/** Палитра карточек — по эталонному шаблону. */
export const CARD_PALETTE: Record<CardKind, { fill: string; border: string }> = {
  goal: { fill: '#b5cc68', border: '#93ab4a' },
  metric: { fill: '#c9e4b4', border: '#93ab4a' },
  subject: { fill: '#f2b33d', border: '#cc9022' },
  hypothesis: { fill: '#f7e36b', border: '#d1bd42' },
  task: { fill: '#a9c7f0', border: '#84a5d6' },
  blocker: { fill: '#f2a6a6', border: '#cc7c7c' },
};

/** Цифры на карточках: 1 — красный (высокий), 2 — оранжевый, 3 — зелёный (низкий). */
export const PRIORITY_COLORS: Record<number, string> = {
  1: '#e05a5a',
  2: '#e8a33d',
  3: '#7cb342',
};

export const LEVEL_TO_PRIORITY: Record<Level, number> = { high: 1, medium: 2, low: 3 };

/** Цвет и толщина стрелки по силе влияния: толщина линиям — по спецификации,
 * заметно ступенчатая (толще — сильнее влияние). */
export const ARROW_STYLE: Record<string, { color: string; width: number }> = {
  high: { color: '#e05a5a', width: 4.5 },
  medium: { color: '#e8a33d', width: 3.2 },
  low: { color: '#7cb342', width: 2 },
  none: { color: '#8a8f98', width: 2.5 },
};

class Card {
  readonly rows: CardRow[] = [];
  private lineCount = 0;
  priority: number | null = null;
  cost: number | null = null;
  extraStyle?: string;
  incomingRight = 0;
  /** Цель уровнем ниже: карточка уже и со сдвигом вправо (вложенность). */
  subLevel = false;

  constructor(
    readonly id: string,
    readonly kind: CardKind,
  ) {}

  get w(): number {
    return this.subLevel ? Math.round(COLUMN_W[this.kind] * 0.85) : COLUMN_W[this.kind];
  }
  get pad(): number {
    return this.kind === 'task' ? TASK_PAD : PAD;
  }
  get height(): number {
    const h = 2 * this.pad + this.lineCount * LINE_H + (this.rows.length - 1) * 4;
    return Math.max(MIN_H[this.kind] ?? 0, h);
  }

  add(label: string, text: string, opts: { boldText?: boolean; cls?: string } = {}): void {
    this.rows.push({ label: label || undefined, text, ...opts });
    const full = `${label} ${text}`.trim();
    this.lineCount += wrapCount(full, Math.floor((this.w - 2 * this.pad) / CHAR_W));
  }
}

function wrapCount(text: string, maxChars: number): number {
  let lines = 0;
  let cur = 0;
  for (const word of text.split(' ')) {
    const add = cur === 0 ? word.length : word.length + 1;
    if (cur > 0 && cur + add > maxChars) {
      lines += 1;
      cur = word.length;
    } else {
      cur += add;
    }
  }
  return lines + (cur > 0 ? 1 : 0);
}

export function computeLayout(map: HypothesisMap): Layout {
  const cards = new Map<string, Card>();

  // --- Цель: метрики внутри карточки, как в эталоне ---
  const goalCard = new Card(map.goal.id, 'goal');
  goalCard.add('', 'Цель', { boldText: true });
  goalCard.add('', map.goal.description);
  const main = map.goal.metrics.filter((m) => !m.balancing);
  if (main.length > 0) {
    goalCard.add('', 'Метрики', { boldText: true });
    for (const m of main) goalCard.add('', `${m.description}: ${m.current} → ${m.target}`);
  }
  const balancing = map.goal.metrics.filter((m) => m.balancing);
  if (balancing.length > 0) {
    goalCard.add('', 'Балансирующие метрики', { boldText: true });
    for (const m of balancing) goalCard.add('', `${m.description}: ${m.current} → ${m.target}`);
  }
  cards.set(map.goal.id, goalCard);

  // --- Дополнительные цели: 'top' — ещё одна цель верхнего уровня,
  //     'sub' — цель уровнем ниже (порождена крупной задачей) ---
  for (const g of map.goals ?? []) {
    const c = new Card(g.id, 'goal');
    const isSub = g.level === 'sub';
    c.subLevel = isSub;
    c.add('', isSub ? 'Подцель (уровень ниже)' : 'Цель', { boldText: true });
    c.add('', g.description);
    const gm = g.metrics ?? [];
    if (gm.length > 0) {
      c.add('', 'Метрики', { boldText: true });
      for (const m of gm) c.add('', `${m.description}: ${m.current} → ${m.target}`);
    }
    cards.set(g.id, c);
  }

  // --- Отдельные карточки метрик (расширенная топология) ---
  for (const m of map.metrics ?? []) {
    const c = new Card(m.id, 'metric');
    c.add('', `Метрика${m.balancing ? ' (балансирующая)' : ''}`, { boldText: true });
    c.add('', m.description);
    c.add('', `${m.current} → ${m.target}`);
    cards.set(m.id, c);
  }

  // --- Субъекты ---
  for (const s of map.subjects) {
    const c = new Card(s.id, 'subject');
    c.priority = LEVEL_TO_PRIORITY[s.influence] ?? null;
    c.add('', s.description, { boldText: true });
    if ((s.pains ?? []).length > 0) {
      c.add('', 'Боли', { boldText: true });
      for (const p of s.pains ?? []) c.add('', p);
    }
    if ((s.wishes ?? []).length > 0) {
      c.add('', 'Желания', { boldText: true });
      for (const wish of s.wishes ?? []) c.add('', wish);
    }
    if (s.negative) {
      // негативный субъект — тот, кто мешает достижению цели: красная рамка
      c.extraStyle = 'outline:3px solid #d15858;outline-offset:-3px';
    }
    cards.set(s.id, c);
  }

  // --- Гипотезы: связки жирным, статусы — только оформлением ---
  for (const h of map.hypotheses) {
    const c = new Card(h.id, 'hypothesis');
    c.priority = LEVEL_TO_PRIORITY[h.influence] ?? null;
    c.cost = LEVEL_TO_PRIORITY[h.cost] ?? null;
    c.add('Если', h.if);
    c.add('то', h.then);
    c.add('потому что', h.because);
    c.add('тогда', h.so);
    c.extraStyle =
      h.status === 'confirmed'
        ? 'outline:3px solid #2f8f2f;outline-offset:-3px'
        : h.status === 'refuted'
          ? 'opacity:.55'
          : h.status === 'draft'
            ? 'outline:2px dashed #8a8f98;outline-offset:-2px'
            : undefined;
    cards.set(h.id, c);
  }

  // --- Задачи-полосы ---
  for (const t of map.tasks) {
    const c = new Card(t.id, 'task');
    c.add('', t.description, { boldText: true });
    if (t.owner || t.due) {
      c.add('', `${t.owner ?? '—'}${t.due ? ` · до ${t.due}` : ''}`, { cls: 'muted' });
    }
    cards.set(t.id, c);
  }

  // --- Блокеры ---
  for (const b of map.blockers) {
    const c = new Card(b.id, 'blocker');
    c.add('', b.reason, { boldText: true });
    if (b.action) c.add('Действие:', b.action);
    if (b.owner || b.due) {
      c.add('', `${b.owner ?? '—'}${b.due ? ` · до ${b.due}` : ''}`, { cls: 'muted' });
    }
    cards.set(b.id, c);
  }

  // --- порядок в колонках: приоритетные гипотезы выше, задачи — рядом со своими гипотезами ---
  const hypothesisOrder = new Map(
    [...map.hypotheses]
      .sort((a, b) => LEVEL_TO_PRIORITY[a.influence] - LEVEL_TO_PRIORITY[b.influence])
      .map((h, i) => [h.id, i]),
  );
  const sortedHypotheses = [...map.hypotheses].sort(
    (a, b) =>
      (hypothesisOrder.get(a.id) ?? 0) - (hypothesisOrder.get(b.id) ?? 0),
  );
  const sortedTasks = [...map.tasks].sort(
    (a, b) =>
      (hypothesisOrder.get(a.hypothesis) ?? 0) - (hypothesisOrder.get(b.hypothesis) ?? 0),
  );

  // --- позиции ---
  const positions = new Map<string, { x: number; y: number }>();
  let x = PAGE_PAD;
  for (const column of COLUMN_ORDER) {
    let y = PAGE_PAD;
    let ordered: string[];
    if (column === 'goal') {
      // колонка целей: главная, затем 'top', затем 'sub' (со сдвигом), затем метрики
      ordered = [
        map.goal.id,
        ...(map.goals ?? []).filter((g) => g.level !== 'sub').map((g) => g.id),
        ...(map.goals ?? []).filter((g) => g.level === 'sub').map((g) => g.id),
        ...(map.metrics ?? []).map((m) => m.id),
      ];
    } else if (column === 'hypothesis') {
      ordered = sortedHypotheses.map((h) => h.id);
    } else if (column === 'task') {
      ordered = sortedTasks.map((t) => t.id);
    } else {
      ordered = [...cards.entries()].filter(([, c]) => c.kind === column).map(([id]) => id);
    }
    for (const id of ordered) {
      const card = cards.get(id);
      if (!card) continue;
      const shift = card.subLevel ? 56 : 0; // вложенность уровня ниже
      positions.set(id, { x: x + shift, y });
      y += card.height + GAP_Y;
    }
    x += COLUMN_W[column] + (column === 'task' ? BLOCKER_GAP : COL_GAP);
  }

  // --- связи: каноническая топология «задача → гипотеза → субъект → цель» ---
  interface RawEdge {
    from: string;
    to: string;
    kind: EdgeKind;
    level: Level | null;
    fromTop?: boolean;
    metricTopY?: number;
  }
  // крупная задача → подцель уровнем ниже: дуга поверх доски
  const topY =
    Math.min(...[...cards.values()].map((c) => positions.get(c.id)!.y)) - 80;
  // отдельные метрики → цель: линия над карточками колонки целей
  const goalsTopY = Math.min(
    positions.get(map.goal.id)!.y,
    ...(map.goals ?? []).map((g) => positions.get(g.id)!.y),
  );

  const rawEdges: RawEdge[] = [
    ...map.tasks.map((t) => ({ from: t.id, to: t.hypothesis, kind: 'flow' as const, level: null })),
    ...map.hypotheses.map((h) => ({
      from: h.id,
      to: h.subject,
      kind: 'flow' as const,
      level: h.influence,
    })),
    // субъект влияет на перечисленные цели либо на главную
    ...map.subjects.flatMap((s) =>
      (s.goals && s.goals.length > 0 ? s.goals : [map.goal.id]).map((gid) => ({
        from: s.id,
        to: gid,
        kind: 'flow' as const,
        level: s.influence,
      })),
    ),
    // отдельные метрики → своя цель: дуга по левой стороне поверх целей
    ...(map.metrics ?? []).map((m) => ({
      from: m.id,
      to: m.goalRef,
      kind: 'metric' as EdgeKind,
      level: null,
      metricTopY: goalsTopY - 45,
    })),
    // задача → подцель уровнем ниже (многоуровневая карта): дуга поверх доски
    ...map.tasks
      .filter((t) => t.goalRef)
      .map((t) => ({
        from: t.id,
        to: t.goalRef!,
        kind: 'sub' as EdgeKind,
        level: null,
        fromTop: true,
      })),
    ...map.blockers.map((b) => ({ from: b.id, to: b.blocks, kind: 'block' as const, level: null })),
  ];

  // Все стрелки входят в правую грань карточки-цели; точки распределяем
  // по высоте грани.

  const incomingIdx = new Map<string, number>();
  const edges: EdgeNode[] = rawEdges.map((e) => {
    const idx = incomingIdx.get(e.to) ?? 0;
    incomingIdx.set(e.to, idx + 1);
    cards.get(e.to)!.incomingRight = Math.max(cards.get(e.to)!.incomingRight, idx + 1);
    return {
      from: e.from,
      to: e.to,
      kind: e.kind,
      level: e.level,
      sourceHandle: 's-left',
      targetHandle: `t-${idx}`,
      ...(e.fromTop ? { topY } : {}),
      ...(e.kind === 'metric' ? { metricTopY: e.metricTopY } : {}),
    };
  });

  const nodes: CardNode[] = [...cards.entries()].map(([id, card]) => {
    const pos = positions.get(id)!;
    return {
      id,
      kind: card.kind,
      x: pos.x,
      y: pos.y,
      w: card.w,
      h: card.height,
      rows: card.rows,
      priority: card.priority,
      cost: card.cost,
      incomingRight: card.incomingRight,
      extraStyle: card.extraStyle,
    };
  });

  return { cards: nodes, edges };
}
