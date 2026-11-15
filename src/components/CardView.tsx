import type { CSSProperties } from 'react';
import type { CardNode } from '../model/layout';
import { CARD_PALETTE } from '../model/layout';

interface Props {
  node: CardNode;
  hovered: boolean;
  onHover: (id: string | null) => void;
}

/** Карточка на доске: геометрия и содержимое — из узла раскладки. */
export function CardView({ node, hovered, onHover }: Props) {
  const palette = CARD_PALETTE[node.kind];
  return (
    <div
      className="card"
      data-id={node.id}
      style={{
        left: node.x,
        top: node.y,
        width: node.w,
        minHeight: node.h,
        background: palette.fill,
        borderColor: palette.border,
        ...(node.extraStyle ? styleFromExtra(node.extraStyle) : {}),
        ...(hovered ? { boxShadow: '0 4px 14px rgba(50,40,20,.28)' } : null),
      }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="head">
        <span className="emoji">{node.emoji}</span>
        <span className="ctype">{node.typeLabel}</span>
      </div>
      {node.badges.length > 0 && (
        <div className="badges">
          {node.badges.map((b, i) => (
            <span key={i} className={`badge ${b.cls}`}>
              {b.text}
            </span>
          ))}
        </div>
      )}
      <div className="body">
        {node.rows.map((row, i) => (
          <div key={i} className={`row ${row.cls}`}>
            {row.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function styleFromExtra(extra: string): CSSProperties {
  const style: Record<string, string> = {};
  for (const decl of extra.split(';')) {
    const [prop, value] = decl.split(':').map((s) => s.trim());
    if (prop && value) style[prop] = value;
  }
  return style as CSSProperties;
}
