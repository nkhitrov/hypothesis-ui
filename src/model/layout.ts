import type { HypothesisMap, Level } from '../types';

/**
 * Колоночная раскладка по эталонному виду карты гипотез (шаблон Miro из базы
 * знаний методологии): крупные «стикерные» карточки — цель-квадрат с метриками
 * внутри, субъекты, вертикальные гипотезы с цифрами влияния и затрат на углу,
 * задачи-полосы. Текст крупный, связки «Если/то/потому что/тогда» — жирным.
 */

export type CardKind = 'goal' | 'subject' | 'hypothesis' | 'task' | 'blocker';
export type EdgeKind = 'flow' | 'metric' | 'balance' | 'block';

/** Строка карточки: жирная связка/заголовок + обычный текст. */
export interface CardRow {
  label?: string;
  text: string;
  boldText?: boolean;
  cls?: string;
}
export interface CardBadge {
  text: string;
  cls: string;
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
  /** Цифра затрат (1–3) — второй квадратик рядом. */
  cost: number | null;
  /** Статус гипотезы — маленький бейдж в правом верхнем углу. */
  statusBadge: CardBadge | null;
  extraStyle?: string;
}
export interface EdgeNode {
  from: string;
  to: string;
  kind: EdgeKind;
  level: Level | null;
  path: string;
  /** Точка крепления стрелки к карточке-источнику (порт). */
  start: { x: number; y: number };
}
export interface Layout {
  cards: CardNode[];
  edges: EdgeNode[];
  width: number;
  height: number;
}

// --- Геометрия и типографика (масштаб «стикера» из эталона) ---
const CHAR_W = 10.4; // средняя ширина символа кириллицы при 19px
const LINE_H = 28; // 19px × 1.5
const PAD = 24;
const TASK_PAD = 18;
const GAP_Y = 26;
const COL_GAP = 120;
const PAGE_PAD = 40;

const COLUMN_ORDER: CardKind[] = ['goal', 'subject', 'hypothesis', 'task', 'blocker'];
const COLUMN_W: Record<CardKind, number> = {
  goal: 400,
  subject: 350,
  hypothesis: 350,
  task: 390,
  blocker: 300,
};
/** Минимальная высота: цель — квадрат, задачи — полосы. */
const MIN_H: Partial<Record<CardKind, number>> = { goal: 400, task: 96 };

/** Палитра карточек — по эталонному шаблону (зелёный/янтарный/соломенный/васильковый). */
export const CARD_PALETTE: Record<CardKind, { fill: string; border: string }> = {
  goal: { fill: '#b5cc68', border: '#93ab4a' },
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

/** Цвет и толщина стрелки по силе влияния. */
export const ARROW_STYLE: Record<string, { color: string; width: number }> = {
  high: { color: '#e05a5a', width: 3.5 },
  medium: { color: '#e8a33d', width: 2.6 },
  low: { color: '#7cb342', width: 2 },
  none: { color: '#8a8f98', width: 1.8 },
};

const STATUS_RU: Record<string, string> = {
  draft: 'черновик',
  'to-verify': 'к проверке',
  confirmed: 'подтверждена',
  refuted: 'опровергнута',
};
const STATUS_CLS: Record<string, string> = {
  draft: 'st-draft',
  'to-verify': 'st-verify',
  confirmed: 'st-ok',
  refuted: 'st-fail',
};

class Card {
  readonly rows: CardRow[] = [];
  private lineCount = 0;
  priority: number | null = null;
  cost: number | null = null;
  statusBadge: CardBadge | null = null;
  extraStyle?: string;

  constructor(
    readonly id: string,
    readonly kind: CardKind,
  ) {}

  get w(): number {
    return COLUMN_W[this.kind];
  }
  get pad(): number {
    return this.kind === 'task' ? TASK_PAD : PAD;
  }
  get height(): number {
    const h = 2 * this.pad + this.lineCount * LINE_H + (this.rows.length - 1) * 4;
    return Math.max(MIN_H[this.kind] ?? 0, h);
  }

  /** Строка с жирной связкой (label) и обычным текстом. */
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
    if (s.negative) c.statusBadge = { text: 'негативный субъект', cls: 'bg-neg' };
    cards.set(s.id, c);
  }

  // --- Гипотезы: две цифры (влияние, затраты), связки жирным ---
  for (const h of map.hypotheses) {
    const c = new Card(h.id, 'hypothesis');
    c.priority = LEVEL_TO_PRIORITY[h.influence] ?? null;
    c.cost = LEVEL_TO_PRIORITY[h.cost] ?? null;
    c.statusBadge = { text: STATUS_RU[h.status] ?? '?', cls: STATUS_CLS[h.status] ?? '' };
    c.add('Если', h.if);
    c.add('то', h.then);
    c.add('потому что', h.because);
    c.add('тогда', h.so);
    c.extraStyle =
      h.status === 'refuted'
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

  // --- позиции ---
  const positions = new Map<string, { x: number; y: number }>();
  let x = PAGE_PAD;
  let maxBottom = 0;
  for (const column of COLUMN_ORDER) {
    let y = PAGE_PAD;
    for (const [id, card] of cards) {
      if (card.kind !== column) continue;
      positions.set(id, { x, y });
      y += card.height + GAP_Y;
    }
    maxBottom = Math.max(maxBottom, y - GAP_Y);
    x += COLUMN_W[column] + COL_GAP;
  }
  const width = x - COL_GAP + PAGE_PAD;
  const height = maxBottom + PAGE_PAD;

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
      statusBadge: card.statusBadge,
      extraStyle: card.extraStyle,
    };
  });

  // --- связи ---
  // По эталону: задачи → гипотезы (серые тонкие), гипотезы → субъекты и цель
  // (цвет и толщина по влиянию), субъекты → цель. Влияние гипотез на метрики
  // визуально ведёт к цели (метрики — внутри карточки цели).
  interface RawEdge {
    from: string;
    to: string;
    kind: EdgeKind;
    level: Level | null;
  }
  const rawEdges: RawEdge[] = [
    ...map.tasks.map((t) => ({ from: t.id, to: t.hypothesis, kind: 'flow' as const, level: null })),
    ...map.hypotheses.flatMap((h) => [
      { from: h.id, to: h.subject, kind: 'flow' as const, level: h.influence },
      { from: h.id, to: map.goal.id, kind: 'metric' as const, level: h.influence },
    ]),
    ...map.subjects.map((s) => ({
      from: s.id,
      to: map.goal.id,
      kind: 'flow' as const,
      level: s.influence,
    })),
    ...map.blockers.map((b) => ({ from: b.id, to: b.blocks, kind: 'block' as const, level: null })),
  ];

  // Входящие связи распределяем по правому краю карточки-цели.
  const incoming = new Map<string, number>();
  for (const e of rawEdges) {
    incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1);
  }
  const seenIncoming = new Map<string, number>();

  const anchorY = (e: RawEdge): number => {
    const t = cards.get(e.to)!;
    const tp = positions.get(e.to)!;
    const n = incoming.get(e.to) ?? 1;
    if (n <= 1) return tp.y + t.height / 2;
    const i = seenIncoming.get(e.to) ?? 0;
    seenIncoming.set(e.to, i + 1);
    const band = Math.max(t.height - 24, 1);
    return tp.y + 12 + ((i + 0.5) * band) / n;
  };

  interface PathResult {
    path: string;
    start: { x: number; y: number };
  }

  const flowPath = (e: RawEdge): PathResult => {
    const f = cards.get(e.from)!;
    const t = cards.get(e.to)!;
    const fp = positions.get(e.from)!;
    const tp = positions.get(e.to)!;
    const x1 = fp.x;
    const y1 = fp.y + f.height / 2;
    const x2 = tp.x + t.w;
    const y2 = anchorY(e);
    const k = COL_GAP * 0.55;
    return {
      path: `M ${x1} ${y1} C ${x1 - k} ${y1}, ${x2 + k} ${y2}, ${x2} ${y2}`,
      start: { x: x1, y: y1 },
    };
  };

  const edges: EdgeNode[] = rawEdges.map((e) => {
    const r = flowPath(e);
    return { ...e, path: r.path, start: r.start };
  });

  return { cards: nodes, edges, width, height };
}
