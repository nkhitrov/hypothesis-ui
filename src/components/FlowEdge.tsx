import { BaseEdge } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

/**
 * Стандартная стрелка карты: справа налево, вход в правую грань карточки.
 *
 * Короткие связи внутри кластера «владелец+вынесенное» (метрика→цель,
 * боль/желание→субъект) рисуются прямой диагональю — как на реальных досках:
 * при плотной упаковке кластера перепад высот невелик, а S-кривая на коротком
 * участке превращается в почти вертикальный хвост.
 *
 * Остальные связи — плоская кубическая кривая с горизонтальными касательными
 * у концов: встроенная безье React Flow держит управляющие точки на половине
 * длины, из-за чего середина кривой уходит почти вертикально. Здесь контрольные
 * точки на FLAT_FRACTION длины: наклон середины лишь в ~1/(1-FLAT_FRACTION) раз
 * больше среднего, вертикальных участков не бывает.
 */
const FLAT_FRACTION = 0.18;
/** До этой длины связь считается внутрикластерной и рисуется прямой. */
const STRAIGHT_MAX_DX = 220;

export function FlowEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
}: EdgeProps) {
  const dx = targetX - sourceX;
  const path =
    Math.abs(dx) < STRAIGHT_MAX_DX
      ? `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`
      : `M ${sourceX} ${sourceY} C ${sourceX + dx * FLAT_FRACTION} ${sourceY} ${
          targetX - dx * FLAT_FRACTION
        } ${targetY} ${targetX} ${targetY}`;
  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}
