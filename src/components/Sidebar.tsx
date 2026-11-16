import type { MapIndexEntry } from '../model/storage';

interface Props {
  index: MapIndexEntry[];
  currentId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/** Список карт: выбор, создание, дублирование, удаление. */
export function Sidebar({
  index,
  currentId,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete,
  onClose,
}: Props) {
  return (
    <aside className="sidebar">
      <header>
        <span>Карты</span>
        <button className="btn small" onClick={onClose} title="Закрыть список">
          ✕
        </button>
      </header>
      <div className="maps">
        {index.map((entry) => (
          <div
            key={entry.id}
            className={`map-item${entry.id === currentId ? ' active' : ''}`}
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
