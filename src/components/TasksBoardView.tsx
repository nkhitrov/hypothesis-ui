import { useMemo } from 'react';
import type { HypothesisMap, TaskStatus } from '../types';
import { TASK_STATUS_LABEL } from '../model/layout';

interface Props {
  map: HypothesisMap;
}

const STATUS_COLUMNS: TaskStatus[] = ['todo', 'in-progress', 'done'];

/**
 * Вид «Доска задач» (портфель проектов, topology.md №8): представление той же
 * модели карты, показывающее статусы ИСПОЛНЕНИЯ задач. Строки — гипотезы,
 * колонки — статусы: задачи остаются привязаны к гипотезам по горизонтали
 * («суть Карты гипотез не теряется — задачи не висят в воздухе»), стрелки
 * задача→гипотеза в этом виде не рисуются. Статус относится только к
 * исполнению и не означает решение о ресурсе или результат проверки гипотезы.
 */
export function TasksBoardView({ map }: Props) {
  /** Активные блокеры по задачам — красной строкой на карточке. */
  const blockersOf = useMemo(() => {
    const byTask = new Map<string, string[]>();
    for (const b of map.blockers) {
      const list = byTask.get(b.blocks) ?? [];
      list.push(b.reason);
      byTask.set(b.blocks, list);
    }
    return byTask;
  }, [map]);

  return (
    <div className="tasks-board">
      <div className="tb-head">
        <div className="tb-corner">Гипотеза</div>
        {STATUS_COLUMNS.map((s) => (
          <div key={s} className="tb-col-head">
            {TASK_STATUS_LABEL[s]}
          </div>
        ))}
      </div>
      {map.hypotheses.map((h) => (
        <div className="tb-row" key={h.id}>
          <div className={`tb-hyp hstatus-${h.status}`}>
            <div className="tb-hyp-if">{h.if}</div>
            <div className="tb-hyp-meta">
              влияние: {h.influence} · затраты: {h.cost}
            </div>
          </div>
          {STATUS_COLUMNS.map((s) => (
            <div className="tb-cell" key={s}>
              {map.tasks
                .filter((t) => t.hypothesis === h.id && (t.status ?? 'todo') === s)
                .map((t) => {
                  const meta = [
                    t.owner ?? null,
                    t.due ? `до ${t.due}` : null,
                  ].filter(Boolean);
                  return (
                    <div className="tb-task" key={t.id} title={t.description}>
                      <div className="tb-task-desc">{t.description}</div>
                      {meta.length > 0 && <div className="tb-task-meta">{meta.join(' · ')}</div>}
                      {t.group && <div className="tb-task-group">{t.group}</div>}
                      {(blockersOf.get(t.id) ?? []).map((reason, i) => (
                        <div className="tb-task-blocker" key={i}>
                          ⚠ {reason}
                        </div>
                      ))}
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      ))}
      {map.hypotheses.length === 0 && (
        <div className="tb-empty">В карте пока нет гипотез — добавьте их в модели</div>
      )}
    </div>
  );
}
