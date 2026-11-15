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
                    markerWidth="12"
                    markerHeight="10"
                    refX="10"
                    refY="5"
                    orient="auto"
                  >
                    <polygon points="0 0, 12 5, 0 10" fill={ARROW_STYLE[key]!.color} />
                  </marker>
                ))}
              </defs>
              {layout.edges.map((edge, i) => {
                const key = edge.level ?? 'none';
                const active =
                  hovered !== null && (edge.from === hovered || edge.to === hovered);
                const dim = hovered !== null && !active;
                // дуги влияния на метрики — тонкие и приглушённые, чтобы не
                // доминировать над основными связями
                const metric = edge.kind === 'metric';
                return (
                  <path
                    key={i}
                    d={edge.path}
                    fill="none"
                    stroke={ARROW_STYLE[key]!.color}
                    strokeWidth={metric ? 1.6 : ARROW_STYLE[key]!.width}
                    opacity={metric ? 0.6 : undefined}
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
              {/* порты: точки крепления стрелок к карточкам-источникам */}
              {layout.edges.map((edge, i) => (
                <circle
                  key={`p-${i}`}
                  cx={edge.start.x}
                  cy={edge.start.y}
                  r={3.5}
                  fill="#1f1f1f"
                  className={hovered !== null && edge.from !== hovered && edge.to !== hovered ? 'dim' : undefined}
                />
              ))}
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
        <span className="chip">
          <i style={{ background: CARD_PALETTE.goal.fill }} /> цель (метрики внутри)
        </span>
        <span className="chip">
          <i style={{ background: CARD_PALETTE.subject.fill }} /> субъект
        </span>
        <span className="chip">
          <i style={{ background: CARD_PALETTE.hypothesis.fill }} /> гипотеза
        </span>
        <span className="chip">
          <i style={{ background: CARD_PALETTE.task.fill }} /> задача
        </span>
        <span className="chip">
          <i style={{ background: CARD_PALETTE.blocker.fill }} /> блокер
        </span>
        <span className="chip">цифры на угле: влияние, затем затраты (1 — красный, 3 — зелёный)</span>
        <span className="chip">толще стрелка — сильнее влияние</span>
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
