import { ValidationErrors } from './ValidationErrors';

interface Props {
  errors: string[];
  onFix: () => void;
  onOpenList: () => void;
}

/**
 * Полноэкранный отказ от рендера: карта нарушает правила методологии
 * (стандарт 1.2, см. docs/knowledge-base). Доска не отрисовывается,
 * пока ошибки не исправлены — например, в текстовом редакторе.
 */
export function InvalidMapScreen({ errors, onFix, onOpenList }: Props) {
  return (
    <div className="invalid-map">
      <h1>Карта не отрисована — нарушены правила Карты гипотез</h1>
      <p>
        Валидация модели не прошла: связи и элементы не соответствуют стандарту
        (задача → гипотеза → субъект/мотивация → цель; задачи не связываются с целями
        напрямую). Исправьте модель — доска появится сразу.
      </p>
      <ValidationErrors errors={errors} />
      <div className="invalid-map-actions">
        <button className="btn primary" onClick={onFix}>
          Исправить в текстовом редакторе
        </button>
        <button className="btn" onClick={onOpenList}>
          Список карт
        </button>
      </div>
      <p className="invalid-map-note">
        Правила: docs/knowledge-base (краткий стандарт 1.2 и топологии).
      </p>
    </div>
  );
}
