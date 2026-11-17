import type { HypothesisMap, Level, MotivationKind } from '../types';

/**
 * Раскладка карты для React Flow: строго горизонтальная карта,
 * стрелки идут только справа налево и входят в правую грань карточки.
 *
 * Колонки: цель | метрика | субъект | боль/желание | гипотеза | задача | блокер
 * (метрики — справа от целей, мотивация — справа от субъектов, стандарт 1.2).
 * Колонка — на каждый тип сущности; если сущностей такого типа нет, колонка
 * скрыта, остальные сдвигаются на её место. Отступ между всеми соседними
 * колонками одинаковый (COL_GAP).
 *
 * По вертикали карточки группируются «полосами» своей ветки: цель с вынесенными
 * метриками и субъект с мотивацией — единые кластеры-блоки, субъекты встают
 * на среднюю точку входа своих метрик/целей, гипотезы, задачи и блокеры —
 * на полосу своей цели воздействия. Пологость стрелок обеспечивают
 * распределённые по правой грани точки входа и эта группировка, а не ширина
 * зазоров между колонками.
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
  /** Дочерняя карта (task.childMapId): клик по карточке открывает её. */
  linkTo?: string;
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
/** Единый отступ между соседними колонками: нижняя граница. Внутри карты
 *  отступ один для всех пар колонок; при необходимости он подрастает
 *  (см. computeX), чтобы самой крутой связи хватало горизонтальной длины. */
const COL_GAP = 180;
/** Потолок единого отступа: компактность важнее — самая крутая связь может
 *  выйти лишь чуть круче диагонали, но не вертикалью ради пустых полей. */
const COL_GAP_MAX = 520;
/** Вертикальный отступ между кластерами «владелец + вынесенное». */
const CLUSTER_GAP = 72;

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
const MIN_H: Partial<Record<CardKind, number>> = { goal: 340, task: 96 };

const average = (xs: number[]): number =>
  xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

/** Отступ, выбранный при последней раскладке. Читает FlowEdge: связи длиной
 *  до «отступ + запас» (соседние колонки) рисуются прямой диагональю. */
export const layoutGap = { value: COL_GAP };

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
  linkTo?: string;
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

export function computeLayout(map: HypothesisMap, opts?: { childGoals?: Record<string, string> }): Layout {
  const cards = new Map<string, Card>();

  // --- Цели: метрики внутри карточки (классическая топология) ---
  // Секции «Метрики»/«Балансирующие метрики» видны всегда: если уровень
  // не заполнен ни в карточке, ни вынесенными карточками — «Нужно заполнить».
  const goalCard = (g: typeof map.goal): Card => {
    const c = new Card(g.id, 'goal');
    c.add('', 'Цель', { boldText: true });
    c.add('', g.description);
    const extracted = (map.metrics ?? []).filter((m) => m.goalRef === g.id);
    const main = g.metrics.filter((m) => !m.balancing);
    if (main.length > 0) {
      c.add('', 'Метрики', { boldText: true });
      for (const m of main) c.add('', `${m.description}: ${m.current} → ${m.target}`);
    } else if (!extracted.some((m) => !m.balancing)) {
      c.add('', 'Метрики', { boldText: true });
      c.add('', 'Нужно заполнить', { cls: 'muted' });
    }
    const balancing = g.metrics.filter((m) => m.balancing);
    if (balancing.length > 0) {
      c.add('', 'Балансирующие метрики', { boldText: true });
      for (const m of balancing) c.add('', `${m.description}: ${m.current} → ${m.target}`);
    } else if (!extracted.some((m) => m.balancing)) {
      c.add('', 'Балансирующие метрики', { boldText: true });
      c.add('', 'Нужно заполнить', { cls: 'muted' });
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

  // --- Субъекты (секции «Боли»/«Желания» всегда видны, как у целей) ---
  for (const s of map.subjects) {
    const c = new Card(s.id, 'subject');
    c.priority = LEVEL_TO_PRIORITY[s.influence] ?? null;
    c.add('', s.description, { boldText: true });
    const mos = (map.motivations ?? []).filter((mo) => mo.subject === s.id);
    if ((s.pains ?? []).length > 0) {
      c.add('', 'Боли', { boldText: true });
      for (const p of s.pains ?? []) c.add('', p);
    } else if (!mos.some((mo) => mo.kind === 'pain')) {
      c.add('', 'Боли', { boldText: true });
      c.add('', 'Нужно заполнить', { cls: 'muted' });
    }
    if ((s.wishes ?? []).length > 0) {
      c.add('', 'Желания', { boldText: true });
      for (const wish of s.wishes ?? []) c.add('', wish);
    } else if (!mos.some((mo) => mo.kind === 'wish')) {
      c.add('', 'Желания', { boldText: true });
      c.add('', 'Нужно заполнить', { cls: 'muted' });
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
    if (t.childMapId) {
      // справа в карточке — цель дочерней карты (клик по плашке = переход);
      // текст приходит из хранилища через opts.childGoals
      c.linkTo = t.childMapId;
      c.add('Цель:', opts?.childGoals?.[t.childMapId] ?? 'карта уровнем ниже не найдена', {
        cls: 'goal-link',
      });
    }
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

  /** Разместить группы колонки сверху вниз без наложений, минимизируя
   *  максимальное отклонение центра группы от предпочтительной позиции.
   *  Жадная расстановка «каждая как можно выше в пределах порога D»
   *  осуществима ⇔ D достаточен; минимальный D ищется бинарным поиском —
   *  колонка не отъезжает от своих полос дальше, чем физически неизбежно. */
  const placeColumn = (stacks: Stack[]): void => {
    if (stacks.length === 0) return;
    const sorted = [...stacks].sort((a, b) => a.preferredCenter - b.preferredCenter);
    const heights = sorted.map(
      (st) => st.ids.reduce((acc, id) => acc + height(id), 0) + (st.ids.length - 1) * INNER_GAP,
    );
    const topsFor = (D: number): number[] | null => {
      const tops: number[] = [];
      let prevBottom = -Infinity;
      for (let i = 0; i < sorted.length; i++) {
        const h = heights[i]!;
        const top = Math.max(
          PAGE_PAD,
          sorted[i]!.preferredCenter - D - h / 2,
          Number.isFinite(prevBottom) ? prevBottom + GAP_Y : PAGE_PAD,
        );
        if (top + h / 2 > sorted[i]!.preferredCenter + D) return null;
        tops.push(top);
        prevBottom = top + h;
      }
      return tops;
    };
    let lo = 0;
    let hi = 4000;
    let tops: number[] | null = null;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const r = topsFor(mid);
      if (r) {
        hi = mid;
        tops = r;
      } else {
        lo = mid + 1;
      }
    }
    tops ??= topsFor(hi)!;
    sorted.forEach((st, i) => {
      let y = tops[i]!;
      for (const id of st.ids) {
        positions.set(id, { x: 0, y });
        y += height(id) + INNER_GAP;
      }
    });
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

  // 1) цели с вынесенными метриками — кластеры-блоки: цель в центре полосы,
  //    её метрики — плотным ровным стеком на той же полосе; соседние кластеры
  //    расходятся так, чтобы чужие метрики не попадали в полосу соседней цели
  const metricOf = new Map<string, string[]>();
  for (const m of map.metrics ?? []) {
    const list = metricOf.get(m.goalRef) ?? [];
    list.push(m.id);
    metricOf.set(m.goalRef, list);
  }
  const placeGoals = (): void => {
    let prevBottom = -Infinity;
    for (const g of allGoals) {
      const mids = metricOf.get(g.id) ?? [];
      const stackH = mids.length
        ? mids.reduce((acc, id) => acc + height(id), 0) + (mids.length - 1) * INNER_GAP
        : 0;
      const unitH = Math.max(height(g.id), stackH);
      const top = Math.max(
        PAGE_PAD,
        Number.isFinite(prevBottom) ? prevBottom + CLUSTER_GAP : PAGE_PAD,
      );
      positions.set(g.id, { x: 0, y: top + (unitH - height(g.id)) / 2 });
      let y = top + (unitH - stackH) / 2;
      for (const id of mids) {
        positions.set(id, { x: 0, y });
        y += height(id) + INNER_GAP;
      }
      prevBottom = top + unitH;
    }
  };

  // 2) субъекты с вынесенной мотивацией — единые вертикальные блоки:
  //    субъект стоит в середине полосы, его боли/желания — плотным стеком
  //    на той же полосе (кластер держится вместе, стрелки короткие).
  //    Якорь блока — средняя точка входа субъекта (метрики или цель)
  const placeSubjects = (): void => {
    const units = map.subjects
      .map((s) => {
        const targets = (s.metrics && s.metrics.length > 0 ? s.metrics : goalIdsOf(s))
          .filter((tid) => cards.has(tid));
        const anchors = targets.map(
          (tid) => entryY.get(`${s.id}→${tid}`) ?? centerY(tid),
        );
        const mos = (map.motivations ?? []).filter((mo) => mo.subject === s.id);
        const moStackH = mos.length
          ? mos.reduce((acc, mo) => acc + height(mo.id), 0) + (mos.length - 1) * INNER_GAP
          : 0;
        return {
          s,
          mos,
          moStackH,
          unitH: Math.max(height(s.id), moStackH),
          preferred: anchors.length ? average(anchors) : PAGE_PAD,
        };
      })
      .sort((a, b) => a.preferred - b.preferred);
    let prevBottom = -Infinity;
    for (const u of units) {
      const top = Math.max(
        PAGE_PAD,
        u.preferred - u.unitH / 2,
        Number.isFinite(prevBottom) ? prevBottom + GAP_Y : PAGE_PAD,
      );
      positions.set(u.s.id, { x: 0, y: top + (u.unitH - height(u.s.id)) / 2 });
      let y = top + (u.unitH - u.moStackH) / 2;
      for (const mo of u.mos) {
        positions.set(mo.id, { x: 0, y });
        y += height(mo.id) + INNER_GAP;
      }
      prevBottom = top + u.unitH;
    }
  };

  // 3) метрики размещены кластерами вместе с целями (см. placeGoals)

  // X колонок: активные колонки (с хотя бы одной карточкой) идут в порядке
  // стандарта с единым отступом — расстояния между соседними колонками
  // равны по построению, пустых колонок на карте нет.
  const present = COLUMN_ORDER.filter((c) => [...cards.values()].some((k) => k.kind === c));
  const computeX = (): void => {
    // Величина отступа — одна на карту. От нижней границы растёт до тех пор,
    // пока самой крутой связи не хватит горизонтальной длины (|Δy| ≤ Δx:
    // соседние связи тогда не круче диагонали, вертикалей не бывает),
    // но не выше потолка — карта не должна расползаться в пустоту.
    let gap = COL_GAP;
    for (const e of edges) {
      if (!positions.has(e.from) || !positions.has(e.to)) continue;
      const si = present.indexOf(cards.get(e.from)!.kind);
      const ti = present.indexOf(cards.get(e.to)!.kind);
      if (si <= ti) continue;
      const dy = Math.abs(centerY(e.from) - (entryY.get(`${e.from}→${e.to}`) ?? centerY(e.to)));
      const n = si - ti; // сколько зазоров перекрывает связь
      let widths = 0;
      for (let i = ti + 1; i < si; i++) widths += COLUMN_W[present[i]!];
      const need = (dy - widths) / n; // зазор, дающий Δx ≥ Δy
      gap = Math.max(gap, Math.min(need, COL_GAP_MAX));
    }
    layoutGap.value = gap;
    let x = PAGE_PAD;
    const colX = new Map<CardKind, number>();
    for (const column of present) {
      colX.set(column, x);
      x += COLUMN_W[column] + gap;
    }
    for (const card of cards.values()) {
      const p = positions.get(card.id);
      if (!p) continue; // колонка ещё не размещена (ранние итерации)
      positions.set(card.id, { x: colX.get(card.kind)!, y: p.y });
    }
  };

  // --- Главная петля сходимости: Y-позиции ↔ точки входа ---
  // Размеры карточек жёсткие — по содержимому; кластеры «владелец+вынесенное»
  // держатся вместе. X от рёбер не зависит (единый отступ), поэтому считается
  // один раз в самом конце, после расстановки всех колонок.
  placeGoals();
  placeSubjects();
  for (let i = 0; i < 4; i++) {
    assignEdges();
    placeGoals();
    placeSubjects();
  }
  assignEdges();

  // 4) боли/желания уже размещены блоками вместе с субъектами (см. placeSubjects)

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
      linkTo: card.linkTo,
    };
  });

  return { cards: nodes, edges };
}

/** Приоритетные гипотезы — выше в своей группе. */
function sortIdsByPriority(ids: string[], map: HypothesisMap): string[] {
  const prio = new Map(map.hypotheses.map((h) => [h.id, LEVEL_TO_PRIORITY[h.influence]]));
  return [...ids].sort((a, b) => (prio.get(a) ?? 9) - (prio.get(b) ?? 9));
}

