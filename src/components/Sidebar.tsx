import type { MapIndexEntry, ProjectEntry } from '../model/storage';

interface Props {
  projects: ProjectEntry[];
  currentProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onDeleteProject: (id: string) => void;
  index: MapIndexEntry[];
  currentId: string;
  /** childMapId → id карты-родителя (дочерние — с отступом под родителем). */
  childOf: Map<string, string>;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/** Панель карт в две колонки: слева — список проектов, справа — карты
 *  выбранного проекта (дочерние — под родителем с отступом). Полные
 *  названия видны при наведении (подсказка), редкие действия — у кнопок
 *  с подсказками. */
export function Sidebar({
  projects,
  currentProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  index,
  currentId,
  childOf,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete,
  onClose,
}: Props) {
  /** Порядок: родительские карты по алфавиту, за каждой — её дочерние. */
  const ordered: Array<{ entry: MapIndexEntry; depth: number }> = [];
  const childrenOf = new Map<string, MapIndexEntry[]>();
  for (const entry of index) {
    const parent = childOf.get(entry.id);
    if (!parent) continue;
    const list = childrenOf.get(parent) ?? [];
    list.push(entry);
    childrenOf.set(parent, list);
  }
  const pushWithChildren = (entry: MapIndexEntry, depth: number): void => {
    ordered.push({ entry, depth });
    for (const child of childrenOf.get(entry.id) ?? []) {
      pushWithChildren(child, depth + 1);
    }
  };
  for (const entry of index) {
    if (!childOf.has(entry.id)) pushWithChildren(entry, 0);
  }
  // дочерняя карта без родителя в списке (родитель удалён) — показываем как обычную
  for (const entry of index) {
    if (!ordered.some((o) => o.entry.id === entry.id)) ordered.push({ entry, depth: 0 });
  }

  const project = projects.find((p) => p.id === currentProjectId);

  return (
    <aside className="sidebar">
      <header>
        <span>Карты</span>
        <button className="btn small" onClick={onClose} title="Закрыть список (Esc не требуется)">
          ✕
        </button>
      </header>
      <div className="pane-wrap">
        {/* левая колонка: проекты — видно все сразу, как и карты справа */}
        <div className="pane projects-pane">
          <div className="pane-title">
            Проекты
            <button
              className="btn small"
              onClick={onCreateProject}
              title="Создать новый проект"
            >
              +
            </button>
          </div>
          <div className="proj-list">
            {projects.map((p) => (
              <div
                key={p.id}
                className={`proj-item${p.id === currentProjectId ? ' active' : ''}`}
                onClick={() => onSelectProject(p.id)}
                title={p.title}
              >
                <span className="name">{p.title}</span>
                <button
                  className="btn small danger"
                  title={`Удалить проект «${p.title}» со всеми его картами`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteProject(p.id);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
        {/* правая колонка: карты выбранного проекта */}
        <div className="pane maps-pane">
          <div className="pane-title" title={project?.title}>
            {project?.title ?? 'Карты'}
          </div>
          <div className="maps">
            {ordered.length === 0 && <div className="empty">В проекте пока нет карт</div>}
            {ordered.map(({ entry, depth }) => (
              <div
                key={entry.id}
                className={`map-item${entry.id === currentId ? ' active' : ''}${
                  depth > 0 ? ' child' : ''
                }`}
                style={depth > 0 ? { paddingLeft: 14 + depth * 16 } : undefined}
                onClick={() => onSelect(entry.id)}
                title={entry.title}
              >
                <span className="name">{entry.title}</span>
                <button
                  className="btn small"
                  title={`Дублировать «${entry.title}»`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(entry.id);
                  }}
                >
                  ⧉
                </button>
                <button
                  className="btn small danger"
                  title={`Удалить «${entry.title}»`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(entry.id);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <footer>
            <button className="btn" onClick={onCreate} title="Создать новую пустую карту в проекте">
              + Новая карта
            </button>
          </footer>
        </div>
      </div>
    </aside>
  );
}
