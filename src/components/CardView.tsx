import type { CSSProperties } from 'react';
import type { CardNode } from '../model/layout';
import { CARD_PALETTE, PRIORITY_COLORS } from '../model/layout';

interface Props {
  node: CardNode;
  hovered: boolean;
  onHover: (id: string | null) => void;
}

/**
 * Карточка-«стикер» по эталонному шаблону: пастельная заливка без рамки,
 * лёгкое скругление, крупный текст, жирные связки, цифры влияния и затрат
 * в квадратиках на левом верхнем углу.
 */
export function CardView({ node, hovered, onHover }: Props) {
  const palette = CARD_PALETTE[node.kind];
  return (
    <div
      className={`card kind-${node.kind}`}
      data-id={node.id}
      style={{
        left: node.x,
        top: node.y,
        width: node.w,
        minHeight: node.h,
        background: palette.fill,
        ...(node.extraStyle ? styleFromExtra(node.extraStyle) : null),
        ...(hovered ? { outline: '2px solid #1f1f1f', outlineOffset: '-2px' } : null),
      }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
    >
      {node.priority !== null && (
        <span
          className="prio first"
          style={{ background: PRIORITY_COLORS[node.priority] }}
          title="Влияние (1 — высокое, 3 — низкое)"
        >
          {node.priority}
        </span>
      )}
      {node.cost !== null && (
        <span
          className="prio second"
          style={{ background: PRIORITY_COLORS[node.cost] }}
          title="Затраты на проверку (1 — высокие, 3 — низкие)"
        >
          {node.cost}
        </span>
      )}
      {node.statusBadge && <span className={`status ${node.statusBadge.cls}`}>{node.statusBadge.text}</span>}
      <div className="body">
        {node.rows.map((row, i) => (
          <div key={i} className={`row ${row.cls ?? ''}`}>
            {row.label && <b>{row.label} </b>}
            <span className={row.boldText ? 'bold' : undefined}>{row.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** «outline:2px dashed …» и т.п. из раскладки → CSS-свойства. */
function styleFromExtra(extra: string): CSSProperties {
  const style: Record<string, string> = {};
  for (const decl of extra.split(';')) {
    const [prop, value] = decl.split(':').map((s) => s.trim());
    if (prop && value) style[prop] = value;
  }
  return style as CSSProperties;
}
