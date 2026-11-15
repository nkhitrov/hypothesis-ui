import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { HypothesisMap } from '../types';
import { ARROW_STYLE, CARD_PALETTE, computeLayout } from '../model/layout';
import { CardView } from './CardView';

interface Props {
  map: HypothesisMap;
}

/** Доска: карточки + SVG-стрелки, зум и панорамирование, hover-подсветка связей. */
export function MapView({ map }: Props) {
  const layout = useMemo(() => computeLayout(map), [map]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const drag = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(
    null,
  );

  const applyZoom = (next: number): void => {
    setZoom(Math.min(2, Math.max(0.35, next)));
  };

  const fit = (): void => {
    const el = scrollRef.current;
    if (!el) return;
    const z = Math.min(1, (el.clientWidth - 16) / layout.width);
    setZoom(z);
    setPan({ x: 0, y: 0 });
  };

  // при первом показе и смене карты — вписать доску по ширине
  useEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.width]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    drag.current = { startX: e.clientX, startY: e.clientY, baseX: pan.x, baseY: pan.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    if (!d) return;
    setPan({ x: d.baseX + e.clientX - d.startX, y: d.baseY + e.clientY - d.startY });
  };

  const onPointerUp = (): void => {
    drag.current = null;
  };

  const transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  const usedLevels = new Set(layout.edges.map((e) => e.level ?? 'none'));

  return (
    <>
      <div
        ref={scrollRef}
        className={`board-scroll${drag.current ? ' dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="board" style={{ width: layout.width, height: layout.height, transform }}>
            <svg
              className="edges"
              width={layout.width}
              height={layout.height}
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {[...usedLevels].map((key) => (
                  <marker
                    key={key}
                    id={`ah-${key}`}
                    markerWidth="9"
                    markerHeight="7"
                    refX="8"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 9 3.5, 0 7" fill={ARROW_STYLE[key]!.color} />
                  </marker>
                ))}
              </defs>
              {layout.edges.map((edge, i) => {
                const key = edge.level ?? 'none';
                const active =
                  hovered !== null && (edge.from === hovered || edge.to === hovered);
                const dim = hovered !== null && !active;
                return (
                  <path
                    key={i}
                    d={edge.path}
                    fill="none"
                    stroke={ARROW_STYLE[key]!.color}
                    strokeWidth={ARROW_STYLE[key]!.width}
                    strokeDasharray={
                      edge.kind === 'metric' || edge.kind === 'balance' || edge.kind === 'block'
                        ? '6 5'
                        : undefined
                    }
                    markerEnd={`url(#ah-${key})`}
                    className={active ? 'hi' : dim ? 'dim' : undefined}
                  />
                );
              })}
            </svg>
            {layout.cards.map((node) => (
              <CardView
                key={node.id}
                node={node}
                hovered={hovered === node.id}
                onHover={setHovered}
              />
            ))}
        </div>
      </div>

      <div className="legend">
        {(Object.keys(CARD_PALETTE) as Array<keyof typeof CARD_PALETTE>).map((kind) => (
          <span key={kind} className="chip">
            <i style={{ background: CARD_PALETTE[kind].fill, borderColor: CARD_PALETTE[kind].border }} />
            {kind === 'goal'
              ? 'цель'
              : kind === 'metric'
                ? 'метрика'
                : kind === 'subject'
                  ? 'субъект'
                  : kind === 'hypothesis'
                    ? 'гипотеза'
                    : kind === 'task'
                      ? 'задача'
                      : 'блокер'}
          </span>
        ))}
        <span className="chip">толще стрелка — сильнее влияние</span>
        <span className="chip">пунктир — метрика/блокер</span>
      </div>

      <div className="zoom">
        <button title="Приблизить" onClick={() => applyZoom(zoom + 0.12)}>
          +
        </button>
        <button title="Уменьшить" onClick={() => applyZoom(zoom - 0.12)}>
          −
        </button>
        <button title="Вписать по ширине" onClick={fit}>
          ⤢
        </button>
      </div>
    </>
  );
}
