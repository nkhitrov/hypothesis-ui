import type { HypothesisMap, Level } from '../types';

/**
 * Детерминированная колоночная раскладка (порт python-черновика renderer_cards.py):
 * координаты карточек вычисляются из модели, поэтому SVG-стрелки проводятся
 * точно от карточки к карточке. Высота карточки — оценка по переносам строк.
 */

export type CardKind = 'goal' | 'metric' | 'subject' | 'hypothesis' | 'task' | 'blocker';
export type EdgeKind = 'flow' | 'metric' | 'balance' | 'block';

export interface CardRow {
  text: string;
  cls: string;
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
  badges: CardBadge[];
  emoji: string;
  typeLabel: string;
  extraStyle?: string;
}
export interface EdgeNode {
  from: string;
  to: string;
  kind: EdgeKind;
  level: Level | null;
  path: string;
}
export interface Layout {
  cards: CardNode[];
  edges: EdgeNode[];
  width: number;
  height: number;
}

// --- Геометрия и типографика ---
const CHAR_W = 7.3;
const LINE_H = 19;
const PAD = 13;
const GAP_Y = 20;
const COL_GAP = 96;
const PAGE_PAD = 28;

const COLUMN_ORDER: CardKind[] = ['goal', 'subject', 'hypothesis', 'task', 'blocker'];
const COLUMN_W: Record<CardKind, number> = {
  goal: 258,
  metric: 258, // метрики живут в колонке цели
  subject: 274,
  hypothesis: 330,
  task: 274,
  blocker: 252,
};

export const CARD_PALETTE: Record<CardKind, { fill: string; border: string }> = {
  goal: { fill: '#c8e6c9', border: '#4e8b4c' },
  metric: { fill: '#bbdefb', border: '#42719f' },
  subject: { fill: '#ffe0b2', border: '#bb7b24' },
  hypothesis: { fill: '#fff59d', border: '#b99b23' },
  task: { fill: '#d6e4f7', border: '#58789f' },
  blocker: { fill: '#ffcdd2', border: '#ad4141' },
};

const EMOJI: Record<CardKind, string> = {
  goal: '🎯',
  metric: '📊',
  subject: '👤',
  hypothesis: '🧪',
  task: '✅',
  blocker: '🚧',
};
const TYPE_RU: Record<CardKind, string> = {
  goal: 'ЦЕЛЬ',
  metric: 'МЕТРИКА',
  subject: 'СУБЪЕКТ',
  hypothesis: 'ГИПОТЕЗА',
  task: 'ЗАДАЧА',
  blocker: 'БЛОКЕР',
};
const LEVEL_RU: Record<Level, string> = { low: 'низк.', medium: 'средн.', high: 'высок.' };
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

/** Цвет и толщина стрелки по силе влияния. */
export const ARROW_STYLE: Record<string, { color: string; width: number }> = {
  high: { color: '#c94a3d', width: 3.2 },
  medium: { color: '#d98a1f', width: 2.4 },
  low: { color: '#6f9a3d', width: 1.9 },
  none: { color: '#8a8f98', width: 1.6 },
};

function wrap(text: string, maxChars: number): string[] {
  const out: string[] = [];
  for (const raw of String(text).split('\n')) {
    let cur = '';
    for (const word of raw.split(' ')) {
      const cand = cur === '' ? word : `${cur} ${word}`;
      if (cur !== '' && cand.length > maxChars) {
        out.push(cur);
        cur = word;
      } else {
        cur = cand;
      }
    }
    out.push(cur);
  }
  return out;
}

class Card {
  readonly lines: string[] = [];
  extraStyle?: string;
  constructor(
    readonly id: string,
    readonly kind: CardKind,
    readonly badges: CardBadge[] = [],
  ) {}
  get w(): number {
    return COLUMN_W[this.column];
  }
  get column(): CardKind {
    // метрики живут в колонке цели
    return this.kind === 'metric' ? 'goal' : this.kind;
  }
  add(text: string, cls = ''): void {
    const maxChars = Math.floor((this.w - 2 * PAD) / CHAR_W);
    const wrapped = wrap(text, maxChars);
    for (const line of wrapped) this.lines.push(cls ? `${cls}\u0000${line}` : `\u0000${line}`);
  }
  get height(): number {
    return (
      2 * PAD + 24 + (this.badges.length ? 18 : 0) + this.lines.length * LINE_H + 4
    );
  }
}

/** Каждая строка закодирована как «css-класс\0текст». */
function decodeLines(card: Card): CardRow[] {
  return card.lines.map((line) => {
    const [cls, ...rest] = line.split('\u0000');
    return { cls: cls ?? '', text: rest.join('\u0000') };
  });
}

export function computeLayout(map: HypothesisMap): Layout {
  const cards = new Map<string, Card>();

  const goalCard = new Card(map.goal.id, 'goal');
  goalCard.add(map.goal.description, 'strong');
  if (map.meta.horizon) goalCard.add(`Горизонт: ${map.meta.horizon}`);
  cards.set(map.goal.id, goalCard);

  for (const m of map.goal.metrics) {
    const c = new Card(
      m.id,
      'metric',
      m.balancing ? [{ text: 'балансирующая', cls: 'bg-bal' }] : [],
    );
    c.add(m.description, 'strong');
    c.add(`${m.current} → цель ${m.target}`);
    cards.set(m.id, c);
  }

  for (const s of map.subjects) {
    const badges: CardBadge[] = [];
    if (s.negative) badges.push({ text: 'негативный субъект', cls: 'bg-neg' });
    badges.push({ text: `влияние: ${LEVEL_RU[s.influence] ?? '—'}`, cls: 'bg-plain' });
    const c = new Card(s.id, 'subject', badges);
    c.add(s.description, 'strong');
    for (const p of s.pains ?? []) c.add(`Боль: ${p}`);
    for (const wish of s.wishes ?? []) c.add(`Желание: ${wish}`);
    cards.set(s.id, c);
  }

  for (const h of map.hypotheses) {
    const badges: CardBadge[] = [
      { text: STATUS_RU[h.status] ?? '?', cls: STATUS_CLS[h.status] ?? '' },
      { text: `влияние: ${LEVEL_RU[h.influence] ?? '—'}`, cls: 'bg-plain' },
      { text: `затраты: ${LEVEL_RU[h.cost] ?? '—'}`, cls: 'bg-plain' },
    ];
    const c = new Card(h.id, 'hypothesis', badges);
    c.add(`Если: ${h.if}`, 'f-if');
    c.add(`То: ${h.then}`, 'f-then');
    c.add(`Потому что: ${h.because}`, 'f-because');
    c.add(`Тогда: ${h.so}`, 'f-so');
    c.extraStyle =
      h.status === 'confirmed'
        ? 'border-width:3px'
        : h.status === 'refuted'
          ? 'opacity:.55'
          : h.status === 'draft'
            ? 'border-style:dashed'
            : undefined;
    cards.set(h.id, c);
  }

  for (const t of map.tasks) {
    const c = new Card(t.id, 'task');
    c.add(`☐ ${t.description}`, 'strong');
    c.add(`${t.owner ?? '—'} · до ${t.due ?? '—'}`, 'muted');
    cards.set(t.id, c);
  }

  for (const b of map.blockers) {
    const c = new Card(b.id, 'blocker');
    c.add(b.reason, 'strong');
    if (b.action) c.add(`Действие: ${b.action}`);
    c.add(`${b.owner ?? '—'} · до ${b.due ?? '—'}`, 'muted');
    cards.set(b.id, c);
  }

  // --- позиции ---
  const positions = new Map<string, { x: number; y: number }>();
  let x = PAGE_PAD;
  let maxBottom = 0;
  for (const column of COLUMN_ORDER) {
    let y = PAGE_PAD;
    for (const [id, card] of cards) {
      if (card.column !== column) continue;
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
      rows: decodeLines(card),
      badges: card.badges,
      emoji: EMOJI[card.kind],
      typeLabel: TYPE_RU[card.kind],
      extraStyle: card.extraStyle,
    };
  });

  // --- связи ---
  const edges: EdgeNode[] = [];

  const flowPath = (fromId: string, toId: string): string => {
    const f = cards.get(fromId)!;
    const t = cards.get(toId)!;
    const fp = positions.get(fromId)!;
    const tp = positions.get(toId)!;
    const x1 = fp.x;
    const y1 = fp.y + f.height / 2;
    const x2 = tp.x + t.w;
    const y2 = tp.y + t.height / 2;
    const k = COL_GAP * 0.55;
    return `M ${x1} ${y1} C ${x1 - k} ${y1}, ${x2 + k} ${y2}, ${x2} ${y2}`;
  };

  const metricArc = (fromId: string, toId: string): string => {
    const f = cards.get(fromId)!;
    const t = cards.get(toId)!;
    const fp = positions.get(fromId)!;
    const tp = positions.get(toId)!;
    const x1 = fp.x + f.w / 2;
    const y1 = fp.y - 4;
    const x2 = tp.x + t.w / 2;
    const y2 = tp.y - 4;
    const lift = 56 + Math.abs(x1 - x2) * 0.04;
    return `M ${x1} ${y1} C ${x1} ${y1 - lift}, ${x2} ${y2 - lift}, ${x2} ${y2}`;
  };

  const balancePath = (fromId: string, toId: string): string => {
    const f = cards.get(fromId)!;
    const t = cards.get(toId)!;
    const fp = positions.get(fromId)!;
    const tp = positions.get(toId)!;
    const x1 = fp.x;
    const y1 = fp.y + f.height / 2;
    const x2 = tp.x;
    const y2 = tp.y + t.height - 14;
    return `M ${x1} ${y1} C ${x1 - 46} ${y1}, ${x2 - 46} ${y2}, ${x2} ${y2}`;
  };

  for (const t of map.tasks) {
    edges.push({ from: t.id, to: t.hypothesis, kind: 'flow', level: null, path: flowPath(t.id, t.hypothesis) });
  }
  for (const h of map.hypotheses) {
    edges.push({
      from: h.id,
      to: h.subject,
      kind: 'flow',
      level: h.influence,
      path: flowPath(h.id, h.subject),
    });
    for (const mid of h.metrics) {
      edges.push({ from: h.id, to: mid, kind: 'metric', level: h.influence, path: metricArc(h.id, mid) });
    }
  }
  for (const s of map.subjects) {
    edges.push({
      from: s.id,
      to: map.goal.id,
      kind: 'flow',
      level: s.influence,
      path: flowPath(s.id, map.goal.id),
    });
  }
  for (const m of map.goal.metrics) {
    edges.push({
      from: m.id,
      to: map.goal.id,
      kind: m.balancing ? 'balance' : 'flow',
      level: null,
      path: m.balancing ? balancePath(m.id, map.goal.id) : flowPath(m.id, map.goal.id),
    });
  }
  for (const b of map.blockers) {
    edges.push({ from: b.id, to: b.blocks, kind: 'block', level: null, path: flowPath(b.id, b.blocks) });
  }

  return { cards: nodes, edges, width, height };
}
