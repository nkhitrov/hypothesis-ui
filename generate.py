#!/usr/bin/env python3
"""Карта гипотез как код.

Читает map.yaml (семантическая модель по методологии картагипотез.рф),
проверяет целостность и рендерит Mermaid-диаграмму в map.md и map.html.

Запуск:  uv run --with pyyaml generate.py [путь-к-карте.yaml]
Ошибки валидации — на stderr, код выхода 1, артефакты не перезаписываются.
Артефакты (map.md, map.html) создаются рядом с файлом карты.
"""

import json
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent
MAP = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / "map.yaml"
OUT_MD = MAP.with_name("map.md")
OUT_HTML = MAP.with_name("map.html")

# Палитра карточек. Стандарт 1.2 задаёт цвета в PDF-приложении; здесь —
# смысловые значения, поменяйте под свой вкус.
COLORS = {
    "goal": "#c8e6c9/#2e7d32",
    "metric": "#bbdefb/#1565c0",
    "subject": "#ffe0b2/#ef6c00",
    "hypothesis": "#fff9c4/#f9a825",
    "task": "#e0e0e0/#616161",
    "blocker": "#ffcdd2/#c62828",
}
EMOJI = {
    "goal": "🎯", "metric": "📊", "subject": "👤",
    "hypothesis": "🧪", "task": "✅", "blocker": "🚧",
}
LABEL_WIDTH = 36  # максимальная длина строки в карточке до переноса
LEVEL_RU = {"low": "низк.", "medium": "средн.", "high": "высок."}
STATUS_RU = {
    "draft": "черновик", "to-verify": "к проверке",
    "confirmed": "подтверждена", "refuted": "опровергнута",
}


def esc(text: str) -> str:
    """Экранирование текста для метки узла Mermaid."""
    return text.replace('"', "&quot;")


def label(lines: list[str]) -> str:
    """Многострочная метка узла в кавычках.

    Длинные строки переносятся по словам (LABEL_WIDTH символов): Mermaid
    не переносит текст в обычных метках и обрезает его многоточием.
    """
    wrapped: list[str] = []
    for line in lines:
        if not line:
            continue
        current = ""
        for word in line.split():
            candidate = f"{current} {word}".strip()
            if current and len(candidate) > LABEL_WIDTH:
                wrapped.append(current)
                current = word
            else:
                current = candidate
        if current:
            wrapped.append(current)
    return '"' + "<br/>".join(esc(x) for x in wrapped) + '"'


def validate(data: dict) -> list[str]:
    """Правила целостности из модели данных методологии."""
    errors: list[str] = []

    goal = data.get("goal") or {}
    metrics = goal.get("metrics") or []
    subjects = data.get("subjects") or []
    hypotheses = data.get("hypotheses") or []
    tasks = data.get("tasks") or []
    blockers = data.get("blockers") or []

    ids: dict[str, str] = {}

    def check_unique(kind: str, items: list[dict]) -> None:
        for item in items:
            item_id = item.get("id")
            if not item_id:
                errors.append(f"{kind}: отсутствует id")
                continue
            if item_id in ids:
                errors.append(f"дубликат id '{item_id}' ({kind} и {ids[item_id]})")
            else:
                ids[item_id] = kind

    check_unique("цель", [goal])
    check_unique("метрика", metrics)
    check_unique("субъект", subjects)
    check_unique("гипотеза", hypotheses)
    check_unique("задача", tasks)
    check_unique("блокер", blockers)

    def exists(item_id: str, what: str) -> bool:
        if item_id not in ids:
            errors.append(f"{what}: ссылка на несуществующий id '{item_id}'")
            return False
        return True

    # Метрики: текущее и целевое значения обязательны.
    for m in metrics:
        for field in ("current", "target"):
            if not m.get(field):
                errors.append(f"метрика '{m.get('id')}': пустое поле '{field}'")

    # Задача без гипотезы — «ставка без действия» наоборот, лишнее действие.
    for t in tasks:
        if t.get("hypothesis"):
            exists(t["hypothesis"], f"задача '{t.get('id')}'")
        else:
            errors.append(f"задача '{t.get('id')}': не привязана к гипотезе")

    # Гипотеза: формат «Если — то — потому что — тогда», субъект и метрики.
    for h in hypotheses:
        hid = h.get("id", "?")
        for field in ("if", "then", "because", "so"):
            if not h.get(field):
                errors.append(f"гипотеза '{hid}': пустая часть формата '{field}' (Если—то—потому что—тогда)")
        if h.get("subject"):
            exists(h["subject"], f"гипотеза '{hid}' (субъект)")
        else:
            errors.append(f"гипотеза '{hid}': не привязана к субъекту")
        if not h.get("metrics"):
            errors.append(f"гипотеза '{hid}': не указана ни одна метрика влияния")
        for mid in h.get("metrics") or []:
            exists(mid, f"гипотеза '{hid}' (метрика)")
        if h.get("status") not in STATUS_RU:
            errors.append(f"гипотеза '{hid}': недопустимый статус '{h.get('status')}'")
        for field in ("influence", "cost"):
            if h.get(field) not in LEVEL_RU:
                errors.append(f"гипотеза '{hid}': недопустимое значение '{field}' = '{h.get(field)}'")

    for s in subjects:
        if s.get("influence") not in LEVEL_RU:
            errors.append(f"субъект '{s.get('id')}': недопустимое значение 'influence'")

    for b in blockers:
        if b.get("blocks"):
            exists(b["blocks"], f"блокер '{b.get('id')}'")
        else:
            errors.append(f"блокер '{b.get('id')}': не указано, что блокирует (поле 'blocks')")

    return errors


def render_mermaid(data: dict) -> str:
    goal = data["goal"]
    metrics = goal.get("metrics") or []
    subjects = data.get("subjects") or []
    hypotheses = data.get("hypotheses") or []
    tasks = data.get("tasks") or []
    blockers = data.get("blockers") or []
    title = (data.get("meta") or {}).get("title", "Карта гипотез")

    lines: list[str] = [
        "---",
        # Двойные кавычки обязательны: в названии бывают двоеточия,
        # а frontmatter Mermaid парсит как YAML.
        f'title: {json.dumps(title, ensure_ascii=False)}',
        "---",
        "flowchart RL",
    ]
    for kind, colors in COLORS.items():
        fill, stroke = colors.split("/")
        lines.append(f"    classDef {kind} fill:{fill},stroke:{stroke},color:#1a1a1a")
    # Статусы гипотез поверх базового класса.
    lines.append("    classDef hyp-confirmed stroke:#2e7d32,stroke-width:3px")
    lines.append("    classDef hyp-refuted opacity:0.45")
    lines.append("    classDef hyp-draft stroke-dasharray:5 5")

    def node(node_id: str, kind: str, node_label: list[str], extra: str = "") -> None:
        classes = ",".join(c for c in (kind, extra) if c)
        lines.append(f"    {node_id}[{label(node_label)}]:::{classes}")

    # Узлы
    node(goal["id"], "goal", [
        f"{EMOJI['goal']} ЦЕЛЬ: {goal['description']}",
        (data.get("meta") or {}).get("horizon", ""),
    ])
    for m in metrics:
        balancing = " (балансирующая)" if m.get("balancing") else ""
        node(m["id"], "metric", [
            f"{EMOJI['metric']} МЕТРИКА{balancing}: {m['description']}",
            f"{m['current']} → {m['target']}",
        ])
    for s in subjects:
        body = [f"{EMOJI['subject']} СУБЪЕКТ (влияние: {LEVEL_RU.get(s.get('influence'), '?')}): {s['description']}"]
        body += [f"боль: {p}" for p in s.get("pains") or []]
        body += [f"желание: {w}" for w in s.get("wishes") or []]
        node(s["id"], "subject", body)
    for h in hypotheses:
        body = [
            f"{EMOJI['hypothesis']} ГИПОТЕЗА [{STATUS_RU.get(h.get('status'), '?')}] "
            f"влияние: {LEVEL_RU.get(h.get('influence'), '?')} · затраты: {LEVEL_RU.get(h.get('cost'), '?')}",
            f"Если: {h['if']}",
            f"то: {h['then']}",
            f"потому что: {h['because']}",
            f"тогда: {h['so']}",
        ]
        status_cls = {
            "confirmed": "hyp-confirmed", "refuted": "hyp-refuted", "draft": "hyp-draft",
        }.get(h.get("status"), "")
        node(h["id"], "hypothesis", body, status_cls)
    for t in tasks:
        node(t["id"], "task", [
            f"{EMOJI['task']} ЗАДАЧА: {t['description']}",
            f"{t.get('owner', '')} · до {t.get('due', '')}",
        ])
    for b in blockers:
        node(b["id"], "blocker", [
            f"{EMOJI['blocker']} БЛОКЕР: {b['reason']}",
            f"действие: {b.get('action', '')} · {b.get('owner', '')} · до {b.get('due', '')}",
        ])

    # Связи: направление влияния — задача проверяет гипотезу, гипотеза действует
    # на субъекта, субъект влияет на цель.
    for t in tasks:
        lines.append(f"    {t['id']} --> {t['hypothesis']}")
    for h in hypotheses:
        lines.append(f"    {h['id']} --> {h['subject']}")
        for mid in h.get("metrics") or []:
            lines.append(f"    {h['id']} -.влияет.-> {mid}")
    for s in subjects:
        lines.append(f"    {s['id']} --> {goal['id']}")
    for m in metrics:
        arrow = "-.баланс.->" if m.get("balancing") else "-->"
        lines.append(f"    {m['id']} {arrow} {goal['id']}")
    for b in blockers:
        lines.append(f"    {b['id']} -.- {b['blocks']}")

    return "\n".join(lines)


def render_markdown(data: dict, diagram: str) -> str:
    meta = data.get("meta") or {}
    legend = "\n".join(
        f"| {EMOJI[kind]} | {'цель метрика субъект гипотеза задача блокер'.split()[i]} |"
        for i, kind in enumerate(["goal", "metric", "subject", "hypothesis", "task", "blocker"])
    )
    return f"""# {meta.get('title', 'Карта гипотез')}

> Горизонт: {meta.get('horizon', '—')} · версия модели: {meta.get('version', '—')} · обновлено: {meta.get('date', '—')}
> Файл сгенерирован автоматически из `map.yaml` — правьте модель, а не эту диаграмму.

```mermaid
{diagram}
```

## Легенда

| Карточка | Тип |
|---|---|
{legend}

Статусы гипотез: жирная зелёная рамка — подтверждена, пунктирная рамка — черновик,
полупрозрачная — опровергнута. Пунктирные стрелки — влияние на метрику и балансирующие метрики.
"""


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>__TITLE__</title>
<style>
  body { font-family: -apple-system, sans-serif; margin: 24px; background: #fafafa; }
  h1 { font-size: 20px; }
  #diagram { background: #fff; padding: 16px; border: 1px solid #e0e0e0;
             border-radius: 8px; overflow: auto; }
  #diagram svg { max-width: 100%; height: auto; }
</style>
</head>
<body>
<h1>__TITLE__</h1>
<p>Сгенерировано из map.yaml — правки вносить в модель, не в этот файл.</p>
<div id="diagram">Рендеринг…</div>
__SCRIPT__
</body>
</html>
"""

# Отрисовка через явный mermaid.render(): источник диаграммы передаётся как
# JS-строка, поэтому разметка внутри него (<br/> и т.п.) не искажается
# HTML-парсером, в отличие от содержимого <pre class="mermaid">.
RENDER_JS = """
const source = __DIAGRAM__;
mermaid.initialize({ startOnLoad: false, flowchart: { nodeSpacing: 40, rankSpacing: 80 } });
mermaid.render("map-diagram", source)
  .then(({ svg }) => { document.getElementById("diagram").innerHTML = svg; })
  .catch((err) => {
    document.getElementById("diagram").textContent =
      "Не удалось отрендерить диаграмму: " + err;
  });
"""

# Если рядом лежит vendor/mermaid.min.js (IIFE-сборка), HTML становится
# полностью автономным: офлайн и встроенные браузеры без доступа к CDN.
# Иначе — фолбэк на CDN (нужен интернет).
VENDOR_MERMAID = ROOT / "vendor" / "mermaid.min.js"
CDN_ESM = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs"


def render_html(title: str, diagram: str) -> str:
    render_js = RENDER_JS.replace("__DIAGRAM__", json.dumps(diagram, ensure_ascii=False))
    if VENDOR_MERMAID.exists():
        # IIFE-сборка определяет window.mermaid — обычный <script> без модулей.
        script = (
            "<script>\n" + VENDOR_MERMAID.read_text(encoding="utf-8") + "\n</script>\n"
            "<script>" + render_js + "</script>"
        )
    else:
        script = (
            '<script type="module">\nimport mermaid from "' + CDN_ESM + '";\n'
            + render_js + "\n</script>"
        )
    return HTML_TEMPLATE.replace("__TITLE__", title).replace("__SCRIPT__", script)


def main() -> int:
    try:
        data = yaml.safe_load(MAP.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"не найден {MAP}", file=sys.stderr)
        return 1
    except yaml.YAMLError as exc:
        print(f"ошибка синтаксиса YAML:\n{exc}", file=sys.stderr)
        return 1

    errors = validate(data)
    if errors:
        print("Карта не прошла проверку целостности:", file=sys.stderr)
        for err in errors:
            print(f"  — {err}", file=sys.stderr)
        return 1

    diagram = render_mermaid(data)
    title = (data.get("meta") or {}).get("title", "Карта гипотез")
    OUT_MD.write_text(render_markdown(data, diagram), encoding="utf-8")
    OUT_HTML.write_text(render_html(title, diagram), encoding="utf-8")

    counts = {
        "метрик": len(data["goal"].get("metrics") or []),
        "субъектов": len(data.get("subjects") or []),
        "гипотез": len(data.get("hypotheses") or []),
        "задач": len(data.get("tasks") or []),
        "блокеров": len(data.get("blockers") or []),
    }
    summary = ", ".join(str(v) + " " + k for k, v in counts.items())
    print(f"OK: {summary}")
    print(f"  → {OUT_MD}")
    print(f"  → {OUT_HTML}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
