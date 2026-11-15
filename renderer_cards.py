"""Карточный рендер карты гипотез.

Генерирует self-contained HTML (без зависимостей): колоночная раскладка
«цель+метрики → субъекты → гипотезы → задачи → блокеры» в духе
специализированных сервисов (Гипотезная/Социотех). Координаты карточек
вычисляются здесь же, поэтому SVG-стрелки проводятся точно от карточки
к карточке, без графовых «спагетти».

Карточки: абсолютное позиционирование, ширина по колонке, высота —
оценка по переносам строк (см. CHAR_W/LINE_H); браузерная высота может
чуть отличаться, стрелки цепляются за оценённый центр — расхождение
в пикселях незаметно.
"""

import html
from html import escape

# --- Геометрия и типографика ----------------------------------------------

FONT = 13           # px, основной текст карточек
CHAR_W = 7.3        # средняя ширина символа кириллицы при этом шрифте
LINE_H = 19         # межстрочный интервал
PAD = 13            # внутренние поля карточки
GAP_Y = 20          # зазор между карточками в колонке
COL_GAP = 96        # расстояние между колонками (место для стрелок)
HEADER_H = 72       # шапка страницы
PAGE_PAD = 28

COLUMN_ORDER = ["goal", "subject", "hypothesis", "task", "blocker"]
COLUMN_W = {"goal": 258, "subject": 274, "hypothesis": 330, "task": 274, "blocker": 252}

# fill, border по типам — каноническая цветовая семантика карты гипотез
PALETTE = {
    "goal": ("#c8e6c9", "#4e8b4c"),
    "metric": ("#bbdefb", "#42719f"),
    "subject": ("#ffe0b2", "#bb7b24"),
    "hypothesis": ("#fff59d", "#b99b23"),
    "task": ("#d6e4f7", "#58789f"),
    "blocker": ("#ffcdd2", "#ad4141"),
}
EMOJI = {
    "goal": "🎯", "metric": "📊", "subject": "👤",
    "hypothesis": "🧪", "task": "✅", "blocker": "🚧",
}
TYPE_RU = {
    "goal": "ЦЕЛЬ", "metric": "МЕТРИКА", "subject": "СУБЪЕКТ",
    "hypothesis": "ГИПОТЕЗА", "task": "ЗАДАЧА", "blocker": "БЛОКЕР",
}

LEVEL_RU = {"low": "низк.", "medium": "средн.", "high": "высок."}
STATUS_RU = {"draft": "черновик", "to-verify": "к проверке",
             "confirmed": "подтверждена", "refuted": "опровергнута"}
STATUS_CLS = {"draft": "st-draft", "to-verify": "st-verify",
              "confirmed": "st-ok", "refuted": "st-fail"}

# цвет и толщина стрелки по силе влияния (None — нейтральная связь)
ARROW_STYLE = {
    "high": ("#c94a3d", 3.2), "medium": ("#d98a1f", 2.4),
    "low": ("#6f9a3d", 1.9), None: ("#8a8f98", 1.6),
}


def wrap(text: str, max_chars: int) -> list[str]:
    """Перенос по словам под ширину карточки."""
    out: list[str] = []
    for raw in str(text).split("\n"):
        cur = ""
        for word in raw.split():
            cand = f"{cur} {word}".strip()
            if cur and len(cand) > max_chars:
                out.append(cur)
                cur = word
            else:
                cur = cand
        out.append(cur)
    return out


class Card:
    def __init__(self, cid: str, kind: str, col: str):
        self.id, self.kind, self.col = cid, kind, col
        self.w = COLUMN_W[col]
        self.body: list[tuple[str, str]] = []   # (текст, css-класс строки)
        self.badges: list[tuple[str, str]] = []  # (текст, css-класс)
        self.lines = 0                          # строк текста для оценки высоты

    def add(self, text: str, cls: str = "") -> None:
        wrapped = wrap(text, int((self.w - 2 * PAD) / CHAR_W))
        self.body.append(("\n".join(wrapped), cls))
        self.lines += len(wrapped)

    def height(self) -> int:
        return 2 * PAD + 24 + (18 if self.badges else 0) + self.lines * LINE_H + (self.lines and 4 or 0)

    def html(self, x: int, y: int, extra_style: str = "") -> str:
        fill, border = PALETTE[self.kind]
        badges = "".join(
            f'<span class="badge {bcls}">{escape(txt)}</span>' for txt, bcls in self.badges
        )
        rows = "".join(
            f'<div class="row {cls}">{escape(txt).replace(chr(10), "<br/>")}</div>'
            for txt, cls in self.body
        )
        return (
            f'<div class="card {self.kind}" id="{self.id}" data-id="{self.id}" '
            f'style="left:{x}px;top:{y}px;width:{self.w}px;min-height:{self.height()}px;'
            f'background:{fill};border-color:{border};{extra_style}">'
            f'<div class="head"><span class="emoji">{EMOJI[self.kind]}</span>'
            f'<span class="ctype">{TYPE_RU[self.kind]}</span></div>'
            + (f'<div class="badges">{badges}</div>' if badges else "")
            + f'<div class="body">{rows}</div></div>'
        )


def build_cards(data: dict) -> dict[str, Card]:
    goal = data["goal"]
    meta = data.get("meta") or {}
    cards: dict[str, Card] = {}

    c = Card(goal["id"], "goal", "goal")
    c.add(goal["description"], "strong")
    if meta.get("horizon"):
        c.add(f"Горизонт: {meta['horizon']}")
    cards[goal["id"]] = c

    for m in goal.get("metrics") or []:
        c = Card(m["id"], "metric", "goal")
        if m.get("balancing"):
            c.badges.append(("балансирующая", "bg-bal"))
        c.add(m["description"], "strong")
        c.add(f"{m.get('current', '—')} → цель {m.get('target', '—')}")
        cards[m["id"]] = c

    for s in data.get("subjects") or []:
        c = Card(s["id"], "subject", "subject")
        if s.get("negative"):
            c.badges.append(("негативный субъект", "bg-neg"))
        c.badges.append((f"влияние: {LEVEL_RU.get(s.get('influence'), '—')}", "bg-plain"))
        c.add(s["description"], "strong")
        for p in s.get("pains") or []:
            c.add(f"Боль: {p}")
        for wsh in s.get("wishes") or []:
            c.add(f"Желание: {wsh}")
        cards[s["id"]] = c

    for h in data.get("hypotheses") or []:
        c = Card(h["id"], "hypothesis", "hypothesis")
        c.badges.append((STATUS_RU.get(h.get("status"), "?"), STATUS_CLS.get(h.get("status"), "")))
        c.badges.append((f"влияние: {LEVEL_RU.get(h.get('influence'), '—')}", "bg-plain"))
        c.badges.append((f"затраты: {LEVEL_RU.get(h.get('cost'), '—')}", "bg-plain"))
        c.add(f"Если: {h['if']}", "f-if")
        c.add(f"То: {h['then']}", "f-then")
        c.add(f"Потому что: {h['because']}", "f-because")
        c.add(f"Тогда: {h['so']}", "f-so")
        extra = ""
        if h.get("status") == "confirmed":
            extra = "border-width:3px;"
        elif h.get("status") == "refuted":
            extra = "opacity:.55;"
        elif h.get("status") == "draft":
            extra = "border-style:dashed;"
        c.extra_style = extra
        cards[h["id"]] = c

    for t in data.get("tasks") or []:
        c = Card(t["id"], "task", "task")
        c.add(f"☐ {t['description']}", "strong")
        c.add(f"{t.get('owner', '—')} · до {t.get('due', '—')}", "muted")
        cards[t["id"]] = c

    for b in data.get("blockers") or []:
        c = Card(b["id"], "blocker", "blocker")
        c.add(b["reason"], "strong")
        if b.get("action"):
            c.add(f"Действие: {b['action']}")
        c.add(f"{b.get('owner', '—')} · до {b.get('due', '—')}", "muted")
        cards[b["id"]] = c

    return cards


def layout(cards: dict[str, Card], data: dict) -> tuple[dict[str, tuple[int, int]], int, int]:
    """Колонки слева направо; возвращает позиции карточек и размер холсты."""
    by_col: dict[str, list[Card]] = {col: [] for col in COLUMN_ORDER}
    for card in cards.values():
        by_col[card.col].append(card)

    # В колонке цели: сначала цель, затем её метрики.
    metrics_order = {m["id"]: i for i, m in enumerate(data["goal"].get("metrics") or [])}
    by_col["goal"].sort(key=lambda c: (c.kind != "goal", metrics_order.get(c.id, 99)))

    positions: dict[str, tuple[int, int]] = {}
    x = PAGE_PAD
    for col in COLUMN_ORDER:
        y = HEADER_H + PAGE_PAD
        for card in by_col[col]:
            positions[card.id] = (x, y)
            y += card.height() + GAP_Y
        x += COLUMN_W[col] + COL_GAP
    width = x - COL_GAP + PAGE_PAD
    height = HEADER_H + 2 * PAGE_PAD + max(
        (sum(c.height() + GAP_Y for c in by_col[col]) for col in COLUMN_ORDER), default=0
    )
    return positions, width, height


Edge = dict  # {"from","to","kind","level","dashed"}


def collect_edges(data: dict) -> list[Edge]:
    goal_id = data["goal"]["id"]
    edges: list[Edge] = []
    for t in data.get("tasks") or []:
        edges.append({"from": t["id"], "to": t["hypothesis"], "kind": "flow", "level": None})
    for h in data.get("hypotheses") or []:
        edges.append({"from": h["id"], "to": h["subject"], "kind": "flow", "level": h.get("influence")})
        for mid in h.get("metrics") or []:
            edges.append({"from": h["id"], "to": mid, "kind": "metric", "level": h.get("influence")})
    for s in data.get("subjects") or []:
        edges.append({"from": s["id"], "to": goal_id, "kind": "flow", "level": s.get("influence")})
    for m in data["goal"].get("metrics") or []:
        edges.append({"from": m["id"], "to": goal_id, "kind": "balance" if m.get("balancing") else "flow", "level": None})
    for b in data.get("blockers") or []:
        edges.append({"from": b["id"], "to": b["blocks"], "kind": "block", "level": None})
    return edges


def edge_path(edge: Edge, pos: dict[str, tuple[int, int]], cards: dict[str, Card]) -> str:
    """Кубическая безье между якорными точками карточек."""
    fx, fy = pos[edge["from"]]
    tx, ty = pos[edge["to"]]
    fc, tc = cards[edge["from"]], cards[edge["to"]]
    fcy, tcy = fy + fc.height() / 2, ty + tc.height() / 2

    if edge["kind"] == "metric":
        # длинная дуга поверх карты: гипотеза (правее) → метрика (колонка цели)
        x1, y1 = fx + fc.w / 2, fy - 4
        x2, y2 = tx + tc.w / 2, ty - 4
        lift = 56 + abs(x1 - x2) * 0.04
        return f"M {x1} {y1} C {x1} {y1 - lift}, {x2} {y2 - lift}, {x2} {y2}"
    if edge["kind"] == "balance":
        # метрика → цель внутри одной колонки: скоба слева от карточек
        x1, y1 = fx, fcy
        x2, y2 = tx, ty + tc.height() - 14
        return f"M {x1} {y1} C {x1 - 46} {y1}, {x2 - 46} {y2}, {x2} {y2}"
    # обычное соседство колонок: источник левым краем, цель — правым
    x1, y1, x2, y2 = fx, fcy, tx + tc.w, tcy
    k = COL_GAP * 0.55
    if edge["kind"] == "block":
        x1, x2 = fx, tx + tc.w  # блокер правее задачи
    return f"M {x1} {y1} C {x1 - k} {y1}, {x2 + k} {y2}, {x2} {y2}"


def render(data: dict) -> str:
    cards = build_cards(data)
    positions, width, height = layout(cards, data)
    edges = collect_edges(data)

    cards_html = "".join(
        cards[cid].html(x, y, getattr(cards[cid], "extra_style", ""))
        for cid, (x, y) in positions.items()
    )

    markers, paths = [], []
    used = set()
    for edge in edges:
        color, sw = ARROW_STYLE[edge["level"]]
        key = edge["level"]
        if key not in used:
            used.add(key)
            markers.append(
                f'<marker id="ah{key}" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">'
                f'<polygon points="0 0, 9 3.5, 0 7" fill="{color}"/></marker>'
            )
        dash = 'stroke-dasharray="6 5"' if edge["kind"] in ("metric", "balance", "block") else ""
        paths.append(
            f'<path data-from="{edge["from"]}" data-to="{edge["to"]}" '
            f'd="{edge_path(edge, positions, cards)}" fill="none" stroke="{color}" '
            f'stroke-width="{sw}" {dash} marker-end="url(#ah{key})"/>'
        )

    meta = data.get("meta") or {}
    legend_chips = "".join(
        f'<span class="chip"><i style="background:{PALETTE[k][0]};border-color:{PALETTE[k][1]}"></i>{TYPE_RU[k].lower()}</span>'
        for k in ("goal", "metric", "subject", "hypothesis", "task", "blocker")
    )
    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>{escape(meta.get("title", "Карта гипотез"))}</title>
<style>
  :root {{ --ink:#22303c; --muted:#6b7684; }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; font-family:-apple-system,"SF Pro Text",system-ui,sans-serif;
         color:var(--ink); background:#f3f1ec; }}
  #top {{ position:fixed; inset:0 0 auto 0; height:{HEADER_H}px; background:#fff;
          border-bottom:1px solid #ddd8cf; display:flex; align-items:center;
          justify-content:space-between; padding:0 20px; z-index:10; }}
  #top h1 {{ font-size:17px; margin:0; }}
  #top .meta {{ font-size:12px; color:var(--muted); margin-top:3px; }}
  #zoom {{ display:flex; gap:6px; }}
  #zoom button {{ width:30px; height:30px; border-radius:8px; border:1px solid #c9c3b8;
                  background:#fff; font-size:16px; cursor:pointer; color:var(--ink); }}
  #scroller {{ position:absolute; inset:{HEADER_H}px 0 0 0; overflow:auto; }}
  #fit {{ transform-origin:0 0; }}
  #board {{ position:relative; width:{width}px; height:{height}px; }}
  #board svg {{ position:absolute; inset:0; z-index:1; }}
  .card {{ position:absolute; border:1.6px solid; border-radius:11px;
           padding:{PAD}px; z-index:2; box-shadow:0 2px 6px rgba(50,40,20,.14);
           font-size:{FONT}px; line-height:{LINE_H}px; }}
  .card .head {{ display:flex; gap:7px; align-items:center; margin-bottom:5px; }}
  .card .emoji {{ font-size:15px; }}
  .card .ctype {{ font-size:11px; font-weight:700; letter-spacing:.6px; opacity:.75; }}
  .badges {{ display:flex; flex-wrap:wrap; gap:5px; margin:2px 0 7px; }}
  .badge {{ font-size:10.5px; padding:1px 8px; border-radius:9px; background:rgba(255,255,255,.72);
            border:1px solid rgba(0,0,0,.22); white-space:nowrap; }}
  .bg-neg {{ background:#f6c9c9; border-color:#a94848; }}
  .bg-bal {{ background:#d9e7f7; border-color:#42719f; }}
  .st-ok {{ background:#d3efd3; border-color:#3f8a3f; font-weight:600; }}
  .st-fail {{ background:#f4d2d2; border-color:#a94848; }}
  .st-verify {{ background:#dbe9f8; border-color:#42719f; }}
  .row {{ margin:2px 0; }}
  .row.strong {{ font-weight:650; }}
  .row.muted {{ color:var(--muted); font-size:12px; }}
  .row.f-if b, .row.f-then b, .row.f-because b, .row.f-so b {{ opacity:.6; }}
  path {{ transition:stroke-width .15s; }}
  path.hi {{ stroke-width:5 !important; }}
  #legend {{ position:absolute; left:{PAGE_PAD}px; top:{HEADER_H - 26}px; display:flex; gap:10px;
             flex-wrap:wrap; font-size:11px; color:var(--muted); z-index:5; }}
  .chip {{ display:inline-flex; align-items:center; gap:4px; }}
  .chip i {{ width:12px; height:12px; border-radius:4px; display:inline-block; border:1.5px solid; }}
  #foot {{ position:absolute; bottom:6px; left:{PAGE_PAD}px; font-size:11px; color:var(--muted); }}
</style>
</head>
<body>
<div id="top">
  <div>
    <h1>{escape(meta.get("title", "Карта гипотез"))}</h1>
    <div class="meta">{escape(meta.get("horizon", ""))} · версия модели {meta.get("version", "—")} · обновлено {meta.get("date", "—")}</div>
  </div>
  <div id="zoom"><button id="zo">−</button><button id="zi">+</button></div>
</div>
<div id="scroller"><div id="fit"><div id="board">
  <svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">
    <defs>{''.join(markers)}</defs>
    {''.join(paths)}
  </svg>
  {cards_html}
  <div id="legend">{legend_chips}</div>
  <div id="foot">Сгенерировано из map.yaml — правки вносить в модель, не в этот файл</div>
</div></div></div>
<script>
  const board = document.getElementById('board');
  const fit = document.getElementById('fit');
  let z = Math.min(1, (document.getElementById('scroller').clientWidth - 8) / board.offsetWidth);
  const apply = () => fit.style.transform = 'scale(' + z + ')';
  apply();
  document.getElementById('zi').onclick = () => {{ z = Math.min(2, z + .12); apply(); }};
  document.getElementById('zo').onclick = () => {{ z = Math.max(.35, z - .12); apply(); }};
  document.querySelectorAll('.card').forEach(c => {{
    const on = flag => document.querySelectorAll(
      'path[data-from="' + c.dataset.id + '"],path[data-to="' + c.dataset.id + '"]'
    ).forEach(p => p.classList.toggle('hi', flag));
    c.addEventListener('mouseenter', () => on(true));
    c.addEventListener('mouseleave', () => on(false));
  }});
</script>
</body>
</html>"""
