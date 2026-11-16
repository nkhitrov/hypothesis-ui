interface Props {
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Явное подтверждение опасного действия (вместо window.confirm). */
export function ConfirmDialog({
  title,
  body,
  confirmLabel = 'Подтвердить',
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="dialog-backdrop">
      <div className="dialog">
        <h3>{title}</h3>
        <p>{body}</p>
        <div className="actions">
          <button className="btn" onClick={onCancel}>
            Отмена
          </button>
          <button className="btn danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
