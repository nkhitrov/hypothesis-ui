import { ValidationErrors } from './ValidationErrors';

export interface ImportPayload {
  fileName: string;
  data: unknown;
  errors: string[];
}

interface Props {
  payload: ImportPayload;
  onConfirm: (asNewMap: boolean) => void;
  onCancel: () => void;
}

/** Диалог импорта: создать новую карту или заменить текущую; при ошибках — только отмена. */
export function ImportDialog({ payload, onConfirm, onCancel }: Props) {
  const title =
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
        <h3>Импорт карты</h3>
        <div className="file">{payload.fileName}</div>
        {title && <p>«{title}»</p>}
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
        ) : (
          <div className="actions">
            <button className="btn" onClick={onCancel}>
              Отмена
            </button>
            <button className="btn" onClick={() => onConfirm(true)}>
              Создать новую карту
            </button>
            <button className="btn primary" onClick={() => onConfirm(false)}>
              Заменить текущую
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
