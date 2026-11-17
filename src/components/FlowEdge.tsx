import { BaseEdge } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { layoutGap } from '../model/layout';

/**
 * Стандартная стрелка карты: справа налево, вход в правую грань карточки.
 *
 * Короткие связи соседних колонок (метрика→цель, боль/желание→субъект,
 * субъект→метрика — по ширине одного межколоночного отступа) рисуются прямой
 * диагональю — как на реальных досках: на коротком участке S-кривая
 * превращается в почти вертикальный хвост.
 *
 * Остальные связи — плоская кубическая кривая с горизонтальными касательными
 * у концов: встроенная безье React Flow держит управляющие точки на половине
 * длины, из-за чего середина кривой уходит почти вертикально. Здесь контрольные
 * точки на FLAT_FRACTION длины: наклон середины лишь в ~1/(1-FLAT_FRACTION) раз
 * больше среднего, вертикальных участков не бывает.
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
  // связи соседних колонок (длиной до отступа + запас) — прямая диагональ
  const straightMaxDx = layoutGap.value + 40;
  const path =
    Math.abs(dx) < straightMaxDx
      ? `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`
      : `M ${sourceX} ${sourceY} C ${sourceX + dx * FLAT_FRACTION} ${sourceY} ${
          targetX - dx * FLAT_FRACTION
        } ${targetY} ${targetX} ${targetY}`;
  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}
