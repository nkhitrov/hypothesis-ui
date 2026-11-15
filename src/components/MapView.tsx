import { useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { HypothesisMap } from '../types';
import { ARROW_STYLE, computeLayout } from '../model/layout';
import { CardView, type StickyNodeData } from './CardView';
import { SubgoalEdge } from './SubgoalEdge';
import { MetricGoalEdge } from './MetricGoalEdge';

interface Props {
  map: HypothesisMap;
}

const nodeTypes = { sticky: CardView };
const edgeTypes = { subgoal: SubgoalEdge, metric: MetricGoalEdge };

/** Доска на React Flow: карточки-узлы, стрелки с цельными наконечниками,
 * точечный фон, зум и панорамирование из коробки. Без анимаций. */
export function MapView({ map }: Props) {
  const { nodes, edges } = useMemo(() => {
    const layout = computeLayout(map);
    const rfNodes: Node<StickyNodeData>[] = layout.cards.map((c) => ({
      id: c.id,
      type: 'sticky',
      position: { x: c.x, y: c.y },
      data: { card: c },
      // размеры узла = размеры карточки из раскладки: обёртка RF обязана
      // совпадать с видимой карточкой, иначе хэндлы и рёбра разъедутся
      style: { width: c.w, height: c.h },
      draggable: false,
      selectable: false,
    }));
    const rfEdges: Edge[] = layout.edges.map((e, i) => {
      const key = e.level ?? 'none';
      // задача→подцель (уровень ниже) — смысловая связь: тёмно-зелёная, заметная
      const isSub = e.kind === 'sub';
      const isMetric = e.kind === 'metric';
      const color =
        e.kind === 'block' ? '#cc7c7c' : isSub ? '#93ab4a' : ARROW_STYLE[key]!.color;
      const width = isSub ? 3 : ARROW_STYLE[key]!.width;
      const markerSize = Math.round(8 + width * 3);
      return {
        id: `e-${i}`,
        source: e.from,
        target: e.to,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        type: isSub ? 'subgoal' : isMetric ? 'metric' : 'default',
        ...(isSub ? { data: { topY: e.topY } } : {}),
        ...(isMetric ? { data: { metricTopY: e.metricTopY } } : {}),
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
  }, [map]);

  return (
    <div className="board-flow">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
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
