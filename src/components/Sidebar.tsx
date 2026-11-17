import type { MapIndexEntry, ProjectEntry } from '../model/storage';

interface Props {
  projects: ProjectEntry[];
  currentProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onDeleteProject: () => void;
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

/** Панель карт: выбор проекта, список его карт (дочерние — под родителем),
 *  создание, дублирование, удаление. */
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
        <button className="btn small" onClick={onClose} title="Закрыть список">
          ✕
        </button>
      </header>
      <div className="projects">
        <select
          value={currentProjectId}
          onChange={(e) => onSelectProject(e.target.value)}
          aria-label="Проект"
          title={project?.title}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <button className="btn small" onClick={onCreateProject} title="Новый проект">
          +
        </button>
        <button
          className="btn small danger"
          onClick={onDeleteProject}
          title="Удалить проект со всеми картами"
        >
          ✕
        </button>
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
          >
            <span className="name" title={entry.title}>
              {entry.title}
            </span>
            <button
              className="btn small"
              title="Дублировать"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(entry.id);
              }}
            >
              ⧉
            </button>
            <button
              className="btn small danger"
              title="Удалить"
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
        <button className="btn" onClick={onCreate}>
          + Новая карта
        </button>
      </footer>
    </aside>
  );
}
