import { BaseEdge } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

/**
 * Стандартная стрелка карты: плоская кубическая кривая слева направо
 * (точнее, справа налево) с горизонтальными касательными у концов.
 *
 * Встроенная безье React Flow держит управляющие точки на половине длины,
 * из-за чего при заметном перепаде высот середина кривой уходит почти
 * вертикально. Здесь контрольные точки на FLAT_FRACTION длины: наклон
 * середины лишь в ~1/(1-FLAT_FRACTION) раз больше среднего, вертикальных
 * участков не бывает. Вход — строго в правую грань карточки-цели.
 */
const FLAT_FRACTION = 0.18;

export function FlowEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
}: EdgeProps) {
  const dx = targetX - sourceX;
  const c1x = sourceX + dx * FLAT_FRACTION;
  const c2x = targetX - dx * FLAT_FRACTION;
  const path = `M ${sourceX} ${sourceY} C ${c1x} ${sourceY} ${c2x} ${targetY} ${targetX} ${targetY}`;
  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}
