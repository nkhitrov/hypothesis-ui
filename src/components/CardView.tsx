import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { CardNode } from '../model/layout';
import { CARD_PALETTE, PRIORITY_COLORS } from '../model/layout';

export interface StickyNodeData extends Record<string, unknown> {
  card: CardNode;
}

export type StickyNode = Node<StickyNodeData, 'sticky'>;

const HIDDEN_HANDLE: CSSProperties = {
  width: 6,
  height: 6,
  left: -3,
  background: 'transparent',
  border: 'none',
  opacity: 0,
};

/**
 * Карточка-«стикер» (узел React Flow) по эталонному шаблону: пастельная
 * заливка, крупный текст, жирные связки, цифры влияния (левый верхний угол)
 * и затрат (левый нижний). Без текстовых тегов — как в эталоне.
 */
export function CardView({ data }: NodeProps<StickyNode>) {
  const node = data.card;
  const palette = CARD_PALETTE[node.kind];
  // квадратик цифры ~1/9 высоты карточки; примыкает ПРАВОЙ гранью к левой
  // грани карточки (в углу, сбоку, не налезая на карточку)
  const badgeSize = Math.max(34, Math.min(60, Math.round(node.h / 9)));
  const badgeFont = Math.round(badgeSize * 0.62);

  return (
    <div
      className={`card kind-${node.kind}`}
      style={{
        width: '100%',
        minHeight: '100%',
        background: palette.fill,
        ...(node.extraStyle ? styleFromExtra(node.extraStyle) : null),
      }}
    >
      <Handle type="source" position={Position.Left} id="s-left" style={HIDDEN_HANDLE} />
      {Array.from({ length: node.incomingRight }, (_, i) => (
        <Handle
          key={`r-${i}`}
          type="target"
          position={Position.Right}
          id={`t-${i}`}
          style={{ ...HIDDEN_HANDLE, left: 'auto', right: -3, top: `${Math.round(((i + 1) / (node.incomingRight + 1)) * 100)}%` }}
         
        />
      ))}

      {node.priority !== null && (
        <span
          className="prio"
          style={{
            background: PRIORITY_COLORS[node.priority],
            width: badgeSize,
            height: badgeSize,
            fontSize: badgeFont,
            left: -badgeSize,
            top: 0,
          }}
          title="Влияние (1 — высокое, 3 — низкое)"
        >
          {node.priority}
        </span>
      )}
      {node.cost !== null && (
        <span
          className="prio"
          style={{
            background: PRIORITY_COLORS[node.cost],
            width: badgeSize,
            height: badgeSize,
            fontSize: badgeFont,
            left: -badgeSize,
            bottom: 0,
          }}
          title="Затраты на проверку (1 — высокие, 3 — низкие)"
        >
          {node.cost}
        </span>
      )}
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
