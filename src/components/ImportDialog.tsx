import type { ProjectFile } from '../model/storage';
import { ValidationErrors } from './ValidationErrors';

export interface ImportPayload {
  fileName: string;
  data: unknown;
  errors: string[];
  /** Файл-проект (группа карт) — режим импорта проекта; null — одиночная карта. */
  project: ProjectFile | null;
}

interface Props {
  payload: ImportPayload;
  onConfirmMap: (asNewMap: boolean) => void;
  onConfirmProject: (replaceCurrent: boolean) => void;
  onCancel: () => void;
}

/** Диалог импорта: карта («новая | заменить») или проект («новый | заменить
 *  текущий»); при ошибках — только отмена, как раньше. */
export function ImportDialog({ payload, onConfirmMap, onConfirmProject, onCancel }: Props) {
  const mapTitle =
    payload.project === null &&
    payload.errors.length === 0 &&
    typeof payload.data === 'object' &&
    payload.data !== null &&
    'meta' in payload.data &&
    typeof (payload.data as { meta?: { title?: unknown } }).meta?.title === 'string'
      ? (payload.data as { meta: { title: string } }).meta.title
      : '';

  return (
    <div className="dialog-backdrop">
      <div className="dialog">
        <h3>{payload.project ? 'Импорт проекта' : 'Импорт карты'}</h3>
        <div className="file">{payload.fileName}</div>
        {payload.project ? (
          <p>
            «{payload.project.project.title}» — карт: {payload.project.maps.length}
          </p>
        ) : (
          mapTitle && <p>«{mapTitle}»</p>
        )}
        {payload.errors.length > 0 ? (
          <>
            <p>Импорт невозможен — найдены проблемы:</p>
            <ValidationErrors errors={payload.errors} />
            <div className="actions">
              <button className="btn" onClick={onCancel}>
                Отмена
              </button>
            </div>
          </>
        ) : payload.project ? (
          <div className="actions">
            <button className="btn" onClick={onCancel}>
              Отмена
            </button>
            <button className="btn" onClick={() => onConfirmProject(false)}>
              Создать новый проект
            </button>
            <button className="btn primary" onClick={() => onConfirmProject(true)}>
              Заменить текущий проект
            </button>
          </div>
        ) : (
          <div className="actions">
            <button className="btn" onClick={onCancel}>
              Отмена
            </button>
            <button className="btn" onClick={() => onConfirmMap(true)}>
              Создать новую карту
            </button>
            <button className="btn primary" onClick={() => onConfirmMap(false)}>
              Заменить текущую
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
