import { BaseEdge } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

/**
 * Отдельная метрика → своя цель (расширенная топология): плавная кривая
 * по левой стороне колонки целей — выход влево, подъём над целями,
 * спуск в зазоре справа от цели и вход строго в правую грань.
 */
export function MetricGoalEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
  data,
}: EdgeProps) {
  const topY = Number((data as { metricTopY?: number } | undefined)?.metricTopY ?? sourceY - 60);
  const yRun = Math.min(topY, sourceY - 8, targetY - 8);
  const midX2 = targetX + 45; // зазор между колонкой целей и субъектами

  const pts: Array<{ x: number; y: number }> = [
    { x: sourceX, y: sourceY },
    { x: sourceX - 45, y: sourceY }, // влево от колонки целей
    { x: sourceX - 45, y: yRun }, // вверх над целями
    { x: midX2, y: yRun },
    { x: midX2, y: targetY }, // вниз к точке входа
    { x: targetX, y: targetY }, // вход в правую грань цели
  ];

  return <BaseEdge path={roundedPath(pts, 70)} markerEnd={markerEnd} style={style} />;
}

/** Плавный маршрут по опорным точкам: прямые стыкуются дугами радиуса r. */
function roundedPath(pts: Array<{ x: number; y: number }>, r: number): string {
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1]!;
    const cur = pts[i]!;
    const next = pts[i + 1]!;
    const inLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const outLen = Math.hypot(next.x - cur.x, next.y - cur.y);
    const rr = Math.min(r, inLen / 2, outLen / 2);
    const a = {
      x: cur.x + ((prev.x - cur.x) / (inLen || 1)) * rr,
      y: cur.y + ((prev.y - cur.y) / (inLen || 1)) * rr,
    };
    const b = {
      x: cur.x + ((next.x - cur.x) / (outLen || 1)) * rr,
      y: cur.y + ((next.y - cur.y) / (outLen || 1)) * rr,
    };
    d += ` L ${a.x} ${a.y} Q ${cur.x} ${cur.y} ${b.x} ${b.y}`;
  }
  const last = pts[pts.length - 1]!;
  d += ` L ${last.x} ${last.y}`;
  return d;
}
