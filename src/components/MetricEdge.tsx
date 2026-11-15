import { BaseEdge } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

/**
 * Дуга гипотеза→цель: строго ортогональный маршрут — выход влево в зазор
 * между колонками, спуск ниже колонки субъектов (или ниже источника,
 * если он сам ниже), горизонталь, подъём и вход строго в правую грань цели.
 */
export function MetricEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
  data,
}: EdgeProps) {
  const lowY = Number((data as { lowY?: number } | undefined)?.lowY ?? 0);
  // линия обхода — не выше низа субъектов и не выше самого источника
  const yRun = Math.max(lowY, sourceY + 8, targetY + 8);
  const path = [
    `M ${sourceX} ${sourceY}`,
    `L ${sourceX - 44} ${sourceY}`, // влево в зазор между колонками
    `L ${sourceX - 44} ${yRun}`, // вниз до линии обхода
    `L ${targetX + 44} ${yRun}`, // горизонталь под колонкой субъектов
    `L ${targetX + 44} ${targetY}`, // к высоте точки входа
    `L ${targetX} ${targetY}`, // вход в правую грань цели
  ].join(' ');

  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}
