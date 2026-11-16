import type { HypothesisMap, Level, MotivationKind } from '../types';

/**
 * Раскладка карты для React Flow: строго горизонтальная карта,
 * стрелки идут только справа налево и входят в правую грань карточки.
 *
 * Колонки: цель | метрика | субъект | боль/желание | гипотеза | задача | блокер
 * (метрики — справа от целей, мотивация — справа от субъектов, стандарт 1.2).
 *
 * Раскладка полосная: карточки выравниваются по «полосе» своей ветки —
 * субъекты и метрики встают на свои точки входа в цель (стрелки почти
 * горизонтальны по построению), цель при необходимости растягивается вниз,
 * чтобы равномерно распределённые по грани точки входа разошлись по полосам.
 * Позиции, точки входа и ширины колонок уточняются итеративно до сходимости;
 * коридоры стрелок субъект→цель считаются по фактической кривизне безье
 * в зоне колонки метрик, поэтому метрики не пересекаются стрелками.
 */

export type CardKind =
  | 'goal'
  | 'metric'
  | 'subject'
  | 'motivation'
  | 'hypothesis'
  | 'task'
  | 'blocker';
export type EdgeKind = 'flow' | 'block';

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
  /** Переопределение цвета (негативный субъект). */
  fill?: string;
  extraStyle?: string;
}
export interface EdgeNode {
  from: string;
  to: string;
  kind: EdgeKind;
  level: Level | null;
  sourceHandle: string;
  targetHandle: string;
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
const GAP_Y = 48; // между группами/полосами
const INNER_GAP = 28; // внутри группы (стек метрик/мотиваций/гипотез/задач)
const PAGE_PAD = 60;
/** Зазоры между колонками: метрики и мотивация прижаты к своим владельцам. */
const COL_GAP = 240;
const OWNER_GAP = 170; // цель→метрика, субъект→мотивация
const BLOCKER_GAP = 120;

/** Порядок колонок слева направо; стрелки идут справа налево. */
const COLUMN_ORDER: CardKind[] = [
  'goal',
  'metric',
  'subject',
  'motivation',
  'hypothesis',
  'task',
  'blocker',
];
const COLUMN_W: Record<CardKind, number> = {
  goal: 400,
  metric: 320,
  subject: 350,
  motivation: 320,
  hypothesis: 350,
  task: 390,
  blocker: 300,
};
const COLUMN_GAP_AFTER: Partial<Record<CardKind, number>> = {
  goal: OWNER_GAP,
  metric: COL_GAP,
  subject: OWNER_GAP,
  motivation: COL_GAP,
  hypothesis: COL_GAP,
  task: BLOCKER_GAP,
};
const MIN_H: Partial<Record<CardKind, number>> = { goal: 340, task: 96 };

/** Порог пологости стрелки: |Δy| ≤ SLOPE_MAX · Δx. Безье локально круче
 *  прямой между концами (~1.5×), поэтому порог ужесточён до ~24° среднего. */
const SLOPE_MAX = 0.45;

const average = (xs: number[]): number =>
  xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

const smoothstep = (t: number): number => 3 * t * t - 2 * t * t * t;

/** Палитра — цветовая кодировка стандарта 1.2 (не менять). */
export const CARD_PALETTE: Record<CardKind, { fill: string; border: string }> = {
  goal: { fill: '#cadf58', border: '#a3b544' },
  metric: { fill: '#cadf58', border: '#a3b544' },
  subject: { fill: '#ffc831', border: '#d9a41f' },
  motivation: { fill: '#ffc831', border: '#d9a41f' },
  hypothesis: { fill: '#ffef73', border: '#d9c94a' },
  task: { fill: '#a6cdff', border: '#84a5d6' },
  blocker: { fill: '#ffa391', border: '#d98070' },
};

/** Негативный субъект — отдельный цвет стандарта. */
const NEGATIVE_SUBJECT_FILL = '#ffb373';

/** Цифры на карточках (элемент): 1 — высокое (красный), 2 — средний, 3 — низкий. */
export const PRIORITY_COLORS: Record<number, string> = {
  1: '#ff7373',
  2: '#ffd723',
  3: '#9ee25b',
};

export const LEVEL_TO_PRIORITY: Record<Level, number> = { high: 1, medium: 2, low: 3 };

/** Цвет и толщина стрелки по силе влияния (приоритет относительно соседа слева):
 * высокий — толстая красная, средний — жёлтая, низкий — тонкая зелёная. */
export const ARROW_STYLE: Record<string, { color: string; width: number }> = {
  high: { color: '#ff7373', width: 4.5 },
  medium: { color: '#ffc831', width: 3.2 },
  low: { color: '#8fd14f', width: 2 },
  none: { color: '#70736d', width: 2.5 },
};

class Card {
  readonly rows: CardRow[] = [];
  private lineCount = 0;
  priority: number | null = null;
  cost: number | null = null;
  fill?: string;
  extraStyle?: string;
  incomingRight = 0;

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
  /** Высота — строго по содержимому (описание + строки), как в стандарте. */
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

const MOTIVATION_LABEL: Record<MotivationKind, string> = { pain: 'Боль', wish: 'Желание' };

/** Группа карточек колонки с предпочтительной позицией (центр полосы). */
interface Stack {
  ids: string[];
  preferredCenter: number;
}

export function computeLayout(map: HypothesisMap): Layout {
  const cards = new Map<string, Card>();

  // --- Цели: метрики внутри карточки (классическая топология) ---
  const goalCard = (g: typeof map.goal): Card => {
    const c = new Card(g.id, 'goal');
    c.add('', 'Цель', { boldText: true });
    c.add('', g.description);
    const main = g.metrics.filter((m) => !m.balancing);
    if (main.length > 0) {
      c.add('', 'Метрики', { boldText: true });
      for (const m of main) c.add('', `${m.description}: ${m.current} → ${m.target}`);
    }
    const balancing = g.metrics.filter((m) => m.balancing);
    if (balancing.length > 0) {
      c.add('', 'Балансирующие метрики', { boldText: true });
      for (const m of balancing) c.add('', `${m.description}: ${m.current} → ${m.target}`);
    }
    return c;
  };
  cards.set(map.goal.id, goalCard(map.goal));
  for (const g of map.goals ?? []) cards.set(g.id, goalCard(g));
  const allGoals = [map.goal, ...(map.goals ?? [])];

  // --- Отдельные метрики: справа от целей, влияние относительно цели ---
  for (const m of map.metrics ?? []) {
    const c = new Card(m.id, 'metric');
    c.priority = LEVEL_TO_PRIORITY[m.influence] ?? null;
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
    if (s.negative) c.fill = NEGATIVE_SUBJECT_FILL;
    cards.set(s.id, c);
  }

  // --- Боли и желания отдельными карточками ---
  for (const mo of map.motivations ?? []) {
    const c = new Card(mo.id, 'motivation');
    c.priority = LEVEL_TO_PRIORITY[mo.influence] ?? null;
    c.add('', MOTIVATION_LABEL[mo.kind], { boldText: true });
    c.add('', mo.description);
    cards.set(mo.id, c);
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
    if (t.childMapId) c.add('', '↳ раскрыта в карту уровнем ниже', { cls: 'muted' });
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

  // --- Связи (по стандарту 1.2; рендерер рисует только эти типы) ---
  interface RawEdge {
    from: string;
    to: string;
    kind: EdgeKind;
    level: Level | null;
  }
  const goalIdsOf = (s: typeof map.subjects[number]): string[] =>
    s.goals && s.goals.length > 0 ? s.goals : [map.goal.id];
  const rawEdges: RawEdge[] = [
    ...map.tasks.map((t) => ({
      from: t.id,
      to: t.hypothesis,
      kind: 'flow' as const,
      level: null,
    })),
    // гипотеза → субъект / боль-желание / цель (бессубъектный контур)
    ...map.hypotheses.map((h) => ({
      from: h.id,
      to: h.target,
      kind: 'flow' as const,
      level: h.influence,
    })),
    // боль/желание → субъект (влияние мотивации относительно субъекта)
    ...(map.motivations ?? []).map((mo) => ({
      from: mo.id,
      to: mo.subject,
      kind: 'flow' as const,
      level: mo.influence,
    })),
    // субъект влияет на вынесенные метрики своей цели (топология «метрики
    // на отдельном уровне») либо — классически — на саму цель
    ...map.subjects.flatMap((s) => {
      const targets = s.metrics && s.metrics.length > 0 ? s.metrics : goalIdsOf(s);
      return targets.map((tid) => ({
        from: s.id,
        to: tid,
        kind: 'flow' as const,
        level: s.influence,
      }));
    }),
    // отдельная метрика → своя цель (влияние относительно цели)
    ...(map.metrics ?? []).map((m) => ({
      from: m.id,
      to: m.goalRef,
      kind: 'flow' as const,
      level: m.influence,
    })),
    ...map.blockers.map((b) => ({
      from: b.id,
      to: b.blocks,
      kind: 'block' as const,
      level: null,
    })),
  ];

  // ================= ПОЛОСНАЯ РАСКЛАДКА =================
  const positions = new Map<string, { x: number; y: number }>();
  const height = (id: string): number => cards.get(id)!.height;
  const centerY = (id: string): number => {
    const p = positions.get(id);
    return p ? p.y + height(id) / 2 : PAGE_PAD;
  };

  /** Разместить группы колонки сверху вниз без наложений, держась полосы.
   *  keepOrder — не сортировать по предпочтению (порядок целей фиксирован). */
  const placeColumn = (stacks: Stack[], keepOrder = false): void => {
    if (stacks.length === 0) return;
    const sorted = keepOrder
      ? stacks
      : [...stacks].sort((a, b) => a.preferredCenter - b.preferredCenter);
    let prevBottom = -Infinity;
    for (const st of sorted) {
      const total =
        st.ids.reduce((acc, id) => acc + height(id), 0) + (st.ids.length - 1) * INNER_GAP;
      const top = Math.max(
        PAGE_PAD,
        st.preferredCenter - total / 2,
        Number.isFinite(prevBottom) ? prevBottom + GAP_Y : PAGE_PAD,
      );
      let y = top;
      for (const id of st.ids) {
        positions.set(id, { x: 0, y });
        y += height(id) + INNER_GAP;
      }
      prevBottom = top + total;
    }
  };

  // Точки входа: входящие связи цели сортируются по Y источника,
  // чтобы стрелки не пересекались между собой; вход — всегда правая грань.
  const edges: EdgeNode[] = [];
  const entryY = new Map<string, number>(); // «from→to» → Y точки входа
  const assignEdges = (): void => {
    edges.length = 0;
    entryY.clear();
    const incoming = new Map<string, RawEdge[]>();
    for (const e of rawEdges) {
      const list = incoming.get(e.to) ?? [];
      list.push(e);
      incoming.set(e.to, list);
    }
    for (const [to, list] of incoming) {
      const posTo = positions.get(to);
      if (!posTo) continue; // цель ещё не размещена (ранние итерации)
      const sorted = [...list].sort((a, b) => centerY(a.from) - centerY(b.from));
      cards.get(to)!.incomingRight = sorted.length;
      sorted.forEach((e, idx) => {
        edges.push({
          from: e.from,
          to: e.to,
          kind: e.kind,
          level: e.level,
          sourceHandle: 's-left',
          targetHandle: `t-${idx}`,
        });
        entryY.set(
          `${e.from}→${e.to}`,
          posTo.y + (height(to) * (idx + 1)) / (sorted.length + 1),
        );
      });
    }
  };

  // 1) цели — стек в фиксированном порядке (главная первой)
  const placeGoals = (): void =>
    placeColumn(
      allGoals.map((g) => ({ ids: [g.id], preferredCenter: PAGE_PAD + height(g.id) / 2 })),
      true,
    );

  // 2) субъекты — на средних точках входа в свои цели воздействия (метрики
  //    или цель, если известны), иначе на центрах: стрелки почти горизонтальны
  const placeSubjects = (): void =>
    placeColumn(
      map.subjects.map((s) => {
        const targets = (s.metrics && s.metrics.length > 0 ? s.metrics : goalIdsOf(s))
          .filter((tid) => cards.has(tid));
        const anchors = targets.map(
          (tid) => entryY.get(`${s.id}→${tid}`) ?? centerY(tid),
        );
        return {
          ids: [s.id],
          preferredCenter: anchors.length ? average(anchors) : PAGE_PAD,
        };
      }),
    );

  // 3) метрики — каждая на своей точке входа в цель (стрелка горизонтальна),
  //    в свободные промежутки между коридорами стрелок субъект→цель.
  //    Коридор в зоне колонки метрик считаем по кривизне безье: у грани цели
  //    кривая уже почти горизонтальна, полный корпус концов был бы излишним.
  const metricOf = new Map<string, string[]>();
  for (const m of map.metrics ?? []) {
    const list = metricOf.get(m.goalRef) ?? [];
    list.push(m.id);
    metricOf.set(m.goalRef, list);
  }
  /** Геометрия колонок по X (уточняется каждую итерацию). */
  interface ColGeom {
    goalRight: number;
    metricLeft: number;
    metricRight: number;
    subjectLeft: number;
  }
  let geom: ColGeom = {
    goalRight: PAGE_PAD + COLUMN_W.goal,
    metricLeft: PAGE_PAD + COLUMN_W.goal + OWNER_GAP,
    metricRight: PAGE_PAD + COLUMN_W.goal + OWNER_GAP + COLUMN_W.metric,
    subjectLeft: PAGE_PAD + COLUMN_W.goal + OWNER_GAP + COLUMN_W.metric + COL_GAP,
  };
  const placeMetrics = (): void => {
    const occupied: Array<[number, number]> = [];
    const D = geom.subjectLeft - geom.goalRight;
    const tNear = Math.max(0, 1 - (geom.metricLeft - geom.goalRight) / D);
    const tFar = Math.max(0, 1 - (geom.metricRight - geom.goalRight) / D);
    // коридоры стрелок, пересекающих колонку метрик: это связи, чья цель —
    // карточка цели (субъект→цель в классике, бессубъектная гипотеза→цель);
    // связи субъект→метрика заканчиваются у грани метрики и колонку не режут
    const corridors: Array<[number, number]> = [];
    const goalIdsSet = new Set(allGoals.map((g) => g.id));
    for (const e of rawEdges) {
      if (!goalIdsSet.has(e.to)) continue;
      const srcY = centerY(e.from);
      const entry = entryY.get(`${e.from}→${e.to}`) ?? centerY(e.to);
      const yNear = srcY + (entry - srcY) * smoothstep(tNear);
      const yFar = srcY + (entry - srcY) * smoothstep(tFar);
      corridors.push([Math.min(yNear, yFar) - 40, Math.max(yNear, yFar) + 40]);
    }
    for (const g of allGoals) {
      const ids = metricOf.get(g.id) ?? [];
      if (ids.length === 0) continue;
      const spread = (ids.length - 1) / 2;
      ids.forEach((id, k) => {
        const anchor =
          entryY.get(`${id}→${g.id}`) ??
          centerY(g.id) + (k - spread) * (height(id) + INNER_GAP);
        const top = freeTop(anchor - height(id) / 2, height(id), [...corridors, ...occupied]);
        positions.set(id, { x: 0, y: top });
        occupied.push([top, top + height(id)]);
      });
    }
    // разведение наложений внутри колонки метрик
    const sorted = (map.metrics ?? [])
      .map((m) => m.id)
      .map((id) => ({ id, y: positions.get(id)!.y }))
      .sort((a, b) => a.y - b.y);
    let prevBottom = -Infinity;
    for (const { id, y } of sorted) {
      const top = Math.max(y, Number.isFinite(prevBottom) ? prevBottom + INNER_GAP : y);
      positions.set(id, { x: 0, y: top });
      prevBottom = top + height(id);
    }
  };

  // X колонок: базовые зазоры, затем адаптивное расширение — зазоры
  // растягиваются, пока каждую стрелку нельзя уложить в порог пологости
  // (|Δy| ≤ SLOPE_MAX · Δx): вертикальных участков у стрелок не бывает
  const present = COLUMN_ORDER.filter((c) => [...cards.values()].some((k) => k.kind === c));
  const colOf = new Map<string, number>();
  present.forEach((c, i) => {
    for (const card of cards.values()) if (card.kind === c) colOf.set(card.id, i);
  });
  const computeX = (): void => {
    const gaps = present.slice(0, -1).map((c) => COLUMN_GAP_AFTER[c] ?? COL_GAP);
    const spanDx = (from: number, to: number): number => {
      // от правой грани колонки to до левой грани колонки from
      let sum = 0;
      for (let i = to; i < from; i++) sum += gaps[i]!;
      for (let i = to + 1; i < from; i++) sum += COLUMN_W[present[i]!];
      return sum;
    };
    for (let pass = 0; pass < 3; pass++) {
      for (const e of edges) {
        if (!positions.has(e.from) || !positions.has(e.to)) continue;
        const si = colOf.get(e.from)!;
        const ti = colOf.get(e.to)!;
        if (si <= ti) continue;
        const dy = Math.abs(centerY(e.from) - (entryY.get(`${e.from}→${e.to}`) ?? centerY(e.to)));
        const need = dy / SLOPE_MAX;
        const have = spanDx(si, ti);
        if (need > have) {
          const deficit = need - have;
          const spanned = si - ti;
          for (let i = ti; i < si; i++) gaps[i]! += deficit / spanned;
        }
      }
    }
    let x = PAGE_PAD;
    const colX = new Map<CardKind, number>();
    present.forEach((column, i) => {
      colX.set(column, x);
      if (i < present.length - 1) x += COLUMN_W[column] + gaps[i]!;
    });
    for (const card of cards.values()) {
      const p = positions.get(card.id);
      if (!p) continue; // колонка ещё не размещена (ранние итерации)
      positions.set(card.id, { x: colX.get(card.kind)!, y: p.y });
    }
    geom = {
      goalRight: colX.get('goal')! + COLUMN_W.goal,
      metricLeft: colX.get('metric') ?? 0,
      metricRight: (colX.get('metric') ?? 0) + COLUMN_W.metric,
      subjectLeft: colX.get('subject') ?? 0,
    };
  };

  // --- Главная петля сходимости: Y-позиции ↔ точки входа ↔ ширины колонок ---
  // Размер карточки цели жёсткий — по содержимому (описание + метрики),
  // под стрелки она НЕ подстраивается; пологость обеспечивают якоря
  // «источник на своей точке входа» и адаптивные зазоры колонок.
  placeGoals();
  placeSubjects();
  placeMetrics();
  for (let i = 0; i < 4; i++) {
    assignEdges();
    placeGoals();
    placeSubjects();
    placeMetrics();
    computeX();
  }
  assignEdges();

  // 4) боли/желания — на полосе своего субъекта
  placeColumn(
    map.subjects
      .map((s) => {
        const ids = (map.motivations ?? []).filter((mo) => mo.subject === s.id).map((mo) => mo.id);
        return ids.length ? { ids, preferredCenter: centerY(s.id) } : null;
      })
      .filter((st): st is Stack => st !== null),
  );

  // 5) гипотезы — группами на полосе своей цели воздействия
  const hypGroups = new Map<string, string[]>();
  for (const h of map.hypotheses) {
    const list = hypGroups.get(h.target) ?? [];
    list.push(h.id);
    hypGroups.set(h.target, list);
  }
  placeColumn(
    [...hypGroups.entries()].map(([target, ids]) => ({
      ids: sortIdsByPriority(ids, map),
      preferredCenter: centerY(target),
    })),
  );

  // 5b) релаксация мотиваций: карточка мотивации смещается на середину между
  //     субъектом и своими гипотезами — обе стрелки делаются положе
  placeColumn(
    map.subjects
      .map((s) => {
        const mos = (map.motivations ?? []).filter((mo) => mo.subject === s.id);
        if (mos.length === 0) return null;
        const preferred = mos.map((mo) => {
          const hyps = hypGroups.get(mo.id) ?? [];
          const anchor = hyps.length
            ? average(hyps.map((h) => centerY(h)))
            : centerY(s.id);
          return (anchor + centerY(s.id)) / 2;
        });
        return { ids: mos.map((mo) => mo.id), preferredCenter: average(preferred) };
      })
      .filter((st): st is Stack => st !== null),
  );

  // 6) задачи — на полосе своей гипотезы
  {
    const groups = new Map<string, string[]>();
    for (const t of map.tasks) {
      const list = groups.get(t.hypothesis) ?? [];
      list.push(t.id);
      groups.set(t.hypothesis, list);
    }
    placeColumn(
      [...groups.entries()].map(([hyp, ids]) => ({
        ids,
        preferredCenter: centerY(hyp),
      })),
    );
  }

  // 7) блокеры — на полосе блокируемой задачи
  {
    const groups = new Map<string, string[]>();
    for (const b of map.blockers) {
      const list = groups.get(b.blocks) ?? [];
      list.push(b.id);
      groups.set(b.blocks, list);
    }
    placeColumn(
      [...groups.entries()].map(([task, ids]) => ({
        ids,
        preferredCenter: centerY(task),
      })),
    );
  }

  assignEdges();
  computeX();

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
      fill: card.fill,
      extraStyle: card.extraStyle,
    };
  });

  return { cards: nodes, edges };
}

/** Приоритетные гипотезы — выше в своей группе. */
function sortIdsByPriority(ids: string[], map: HypothesisMap): string[] {
  const prio = new Map(map.hypotheses.map((h) => [h.id, LEVEL_TO_PRIORITY[h.influence]]));
  return [...ids].sort((a, b) => (prio.get(a) ?? 9) - (prio.get(b) ?? 9));
}

/** Ближайший свободный отрезок [top, top+h] вне запретных коридоров. */
function freeTop(idealTop: number, h: number, corridors: Array<[number, number]>): number {
  if (corridors.length === 0) return Math.max(PAGE_PAD, idealTop);
  const hits = (top: number): boolean =>
    corridors.some(([lo, hi]) => top < hi && lo < top + h) || top < PAGE_PAD;
  for (let d = 0; d <= 2400; d += 20) {
    for (const top of d === 0 ? [idealTop] : [idealTop - d, idealTop + d]) {
      if (!hits(top)) return top;
    }
  }
  return Math.max(PAGE_PAD, idealTop);
}
