import { useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { HypothesisMap } from '../types';
import { ARROW_STYLE, computeLayout } from '../model/layout';
import { loadViewport } from '../model/storage';
import { CardView, type StickyNodeData } from './CardView';
import { FlowEdge } from './FlowEdge';

interface Props {
  map: HypothesisMap;
  /** id карты в хранилище — ключ закрепления области просмотра. */
  mapId: string;
  /** Тексты целей дочерних карт (childMapId → описание цели) — для плашек. */
  childGoals?: Record<string, string>;
  /** Переход в дочернюю карту: клик по плашке цели на задаче. */
  onOpenMap?: (id: string) => void;
  /** Запомнить область просмотра карты (вызывается по окончании пан/зум). */
  onViewportSave?: (mapId: string, viewport: Viewport) => void;
}

const nodeTypes = { sticky: CardView };
const edgeTypes = { flow: FlowEdge };

/** Доска на React Flow: карточки-узлы и строго горизонтальные стрелки
 *  (плавные кривые справа налево, вход в правую грань). Без анимаций.
 *  Область просмотра закреплена за картой: при открытии восстанавливается
 *  сохранённая позиция/масштаб (иначе — вписывание по ширине). */
export function MapView({ map, mapId, childGoals, onOpenMap, onViewportSave }: Props) {
  const savedViewport = useMemo(() => loadViewport(mapId), [mapId]);
  const { nodes, edges } = useMemo(() => {
    const layout = computeLayout(map, { childGoals });
    const rfNodes: Node<StickyNodeData>[] = layout.cards.map((c) => ({
      id: c.id,
      type: 'sticky',
      position: { x: c.x, y: c.y },
      data: { card: c, openMap: onOpenMap },
      // размеры узла = размеры карточки из раскладки: обёртка RF обязана
      // совпадать с видимой карточкой, иначе хэндлы и рёбра разъедутся.
      // pointerEvents: RF v12 ставит узлам pointer-events:none, когда они
      // не selectable/draggable — кликабельным карточкам включаем явно,
      // иначе реальные клики попадают в панель под узлами
      style: { width: c.w, height: c.h, ...(c.linkTo ? { pointerEvents: 'all' } : null) },
      draggable: false,
      selectable: false,
    }));
    const rfEdges: Edge[] = layout.edges.map((e, i) => {
      const key = e.level ?? 'none';
      const isBlock = e.kind === 'block';
      const color = isBlock ? '#cc7c7c' : ARROW_STYLE[key]!.color;
      const width = isBlock ? 2 : ARROW_STYLE[key]!.width;
      const markerSize = Math.round(8 + width * 3);
      return {
        id: `e-${i}`,
        source: e.from,
        target: e.to,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        type: 'flow',
        style: { stroke: color, strokeWidth: width },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: markerSize,
          height: markerSize,
          color,
        },
      };
    });
    return { nodes: rfNodes, edges: rfEdges };
    // onOpenMap в зависимостях: колбэк замыкает текущую карту (кнопка «← назад»)
  }, [map, childGoals, onOpenMap]);

  return (
    <div className="board-flow">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView={!savedViewport}
        fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
        defaultViewport={savedViewport ?? undefined}
        onMoveEnd={(_, viewport) => onViewportSave?.(mapId, viewport)}
        minZoom={0.05}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        edgesFocusable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1.3} color="#d9d9d9" />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
      <div className="legend">
        <span className="chip"><i style={{ background: ARROW_STYLE.high.color }} />1 — высокое влияние/затраты</span>
        <span className="chip"><i style={{ background: ARROW_STYLE.medium.color }} />2 — среднее</span>
        <span className="chip"><i style={{ background: ARROW_STYLE.low.color }} />3 — низкое</span>
        <span className="chip">цифры на карточке: влияние (верх) и затраты (низ)</span>
        <span className="chip">толще стрелка — сильнее влияние</span>
        <span className="chip">красная тонкая к задаче — блокер</span>
      </div>
    </div>
  );
}
