import { useState } from 'react';
import type { HypothesisMap } from '../types';
import { parseMapText, serializeMap, type MapFormat } from '../model/io';
import { validateMap } from '../model/validate';
import { ValidationErrors } from './ValidationErrors';

interface Props {
  map: HypothesisMap;
  onApply: (next: HypothesisMap) => void;
  onClose: () => void;
}

/** Панель «модель как текст»: YAML/JSON, применить с валидацией, откатить. */
export function TextEditor({ map, onApply, onClose }: Props) {
  const [format, setFormat] = useState<MapFormat>('yaml');
  const [text, setText] = useState(() => serializeMap(map, 'yaml'));
  const [errors, setErrors] = useState<string[]>([]);

  const switchFormat = (next: MapFormat): void => {
    if (next === format) return;
    // правки сохраняем: конвертируем текущий текст, если он парсится
    const parsed = parseMapText(text);
    if (!parsed.ok) {
      setErrors([
        `не удалось переключить формат: ${parsed.error}; исправьте текст или откатите правки`,
      ]);
      return;
    }
    setFormat(next);
    setText(serializeMap(parsed.data, next));
    setErrors([]);
  };

  const apply = (): void => {
    const parsed = parseMapText(text);
    if (!parsed.ok) {
      setErrors([parsed.error]);
      return;
    }
    const validation = validateMap(parsed.data);
    if (validation.length > 0) {
      setErrors(validation);
      return;
    }
    onApply(parsed.data as HypothesisMap);
    setText(serializeMap(parsed.data, format));
    setErrors([]);
  };

  const revert = (): void => {
    setText(serializeMap(map, format));
    setErrors([]);
  };

  return (
    <div className="editor">
      <header>
        <div className="seg">
          <button className={format === 'yaml' ? 'active' : ''} onClick={() => switchFormat('yaml')}>
            YAML
          </button>
          <button className={format === 'json' ? 'active' : ''} onClick={() => switchFormat('json')}>
            JSON
          </button>
        </div>
        <span className="hint">
          Модель карты как текст — правьте сами или вставьте вариант от LLM, затем «Применить»
        </span>
        <button className="btn" onClick={revert} title="Вернуть текст к текущей модели">
          Откатить
        </button>
        <button className="btn primary" onClick={apply}>
          Применить
        </button>
        <button className="btn" onClick={onClose}>
          К карте
        </button>
      </header>
      {errors.length > 0 && <ValidationErrors errors={errors} />}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        aria-label="Модель карты в текстовом виде"
      />
    </div>
  );
}
