import { useMemo, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import type { HypothesisMap } from './types';
import {
  bootstrap,
  createMap,
  deleteMap,
  duplicateMap,
  isVolatile,
  loadIndex,
  loadMap,
  newId,
  saveMap,
} from './model/storage';
import {
  copyToClipboard,
  downloadTextFile,
  fileNameFor,
  parseMapText,
  serializeMap,
  type MapFormat,
} from './model/io';
import { validateMap } from './model/validate';
import { MapView } from './components/MapView';
import { Sidebar } from './components/Sidebar';
import { TextEditor } from './components/TextEditor';
import { ImportDialog, type ImportPayload } from './components/ImportDialog';

type View = 'board' | 'editor';

export default function App() {
  const start = useMemo(() => bootstrap(), []);
  const [currentId, setCurrentId] = useState(start.currentId);
  const [map, setMap] = useState<HypothesisMap>(() => loadMap(start.currentId) ?? createMap('Новая карта').map);
  const [view, setView] = useState<View>('board');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [indexTick, setIndexTick] = useState(0);
  const [importPayload, setImportPayload] = useState<ImportPayload | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const index = useMemo(() => loadIndex(), [indexTick]);

  const notify = (message: string): void => {
    setFlash(message);
    window.setTimeout(() => setFlash(null), 2500);
  };

  /** Единственная точка изменения текущей карты: валидация → стейт → автосохранение. */
  const applyModel = (next: HypothesisMap): string[] => {
    const errors = validateMap(next);
    if (errors.length > 0) return errors;
    setMap(next);
    saveMap(currentId, next);
    return [];
  };

  const selectMap = (id: string): void => {
    const loaded = loadMap(id);
    if (!loaded) return;
    setCurrentId(id);
    setMap(loaded);
    setSidebarOpen(false);
  };

  const handleCreate = (): void => {
    const created = createMap(`Новая карта ${index.length + 1}`);
    setCurrentId(created.id);
    setMap(created.map);
    setIndexTick((t) => t + 1);
    notify('Карта создана');
  };

  const handleDuplicate = (id: string): void => {
    const copy = duplicateMap(id);
    if (!copy) return;
    setCurrentId(copy.id);
    setMap(copy.map);
    setIndexTick((t) => t + 1);
    notify('Карта продублирована');
  };

  const handleDelete = (id: string): void => {
    const entry = index.find((e) => e.id === id);
    if (!window.confirm(`Удалить карту «${entry?.title ?? id}»? Действие необратимо.`)) return;
    deleteMap(id);
    setIndexTick((t) => t + 1);
    if (id === currentId) {
      const remaining = loadIndex();
      if (remaining.length > 0) {
        setCurrentId(remaining[0]!.id);
        setMap(loadMap(remaining[0]!.id) ?? createMap('Новая карта').map);
      } else {
        const fresh = createMap('Новая карта');
        setCurrentId(fresh.id);
        setMap(fresh.map);
      }
    }
    notify('Карта удалена');
  };

  const renameMap = (title: string): void => {
    if (title.trim() === '' || title === map.meta.title) return;
    applyModel({ ...map, meta: { ...map.meta, title: title.trim() } });
    setIndexTick((t) => t + 1);
  };

  const exportAs = (format: MapFormat): void => {
    downloadTextFile(
      fileNameFor(map.meta.title, format),
      serializeMap(map, format),
      format === 'json' ? 'application/json' : 'text/yaml',
    );
  };

  const copyAs = async (format: MapFormat): Promise<void> => {
    const ok = await copyToClipboard(serializeMap(map, format));
    notify(ok ? `Скопировано в буфер (${format.toUpperCase()})` : 'Не удалось скопировать');
  };

  /** Импорт: парсинг + валидация → диалог (новая карта | заменить | отмена при ошибках). */
  const ingest = (fileName: string, text: string): void => {
    const parsed = parseMapText(text);
    if (!parsed.ok) {
      setImportPayload({ fileName, data: null, errors: [parsed.error] });
      return;
    }
    const errors = validateMap(parsed.data);
    setImportPayload({ fileName, data: parsed.data, errors });
  };

  const readFile = (file: File): void => {
    void file.text().then((text) => ingest(file.name, text));
  };

  const confirmImport = (asNewMap: boolean): void => {
    if (!importPayload || importPayload.errors.length > 0) {
      setImportPayload(null);
      return;
    }
    const incoming = importPayload.data as HypothesisMap;
    if (asNewMap) {
      const id = newId();
      saveMap(id, incoming);
      setCurrentId(id);
      setMap(incoming);
      setIndexTick((t) => t + 1);
      notify('Импортирована новая карта');
    } else {
      applyModel(incoming);
      notify('Текущая карта заменена');
    }
    setImportPayload(null);
  };

  const onDrop = (e: ReactDragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  };

  return (
    <div className="app" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      <div className="topbar">
        <button className="btn" onClick={() => setSidebarOpen((v) => !v)} title="Список карт">
          ☰ Карты
        </button>
        <span className="brand">КАРТА ГИПОТЕЗ</span>
        <input
          className="map-title"
          value={map.meta.title}
          onChange={(e) => setMap({ ...map, meta: { ...map.meta, title: e.target.value } })}
          onBlur={(e) => renameMap(e.target.value)}
          aria-label="Название карты"
        />
        <button className="btn" onClick={() => fileInputRef.current?.click()}>
          Импорт
        </button>
        <button className="btn" onClick={() => void copyAs('yaml')} title="Скопировать YAML в буфер">
          ⧉ YAML
        </button>
        <button className="btn" onClick={() => exportAs('yaml')}>
          ↓ YAML
        </button>
        <button className="btn" onClick={() => exportAs('json')}>
          ↓ JSON
        </button>
        {view === 'board' ? (
          <button className="btn primary" onClick={() => setView('editor')}>
            Модель как текст
          </button>
        ) : (
          <button className="btn" onClick={() => setView('board')}>
            К карте
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".yaml,.yml,.json,application/json,text/yaml"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) readFile(file);
          e.target.value = '';
        }}
      />

      {isVolatile() && (
        <div className="banner">
          Хранилище браузера недоступно: изменения живут только до перезагрузки. Сохраняйте карту
          через экспорт.
        </div>
      )}
      {flash && <div className="banner">{flash}</div>}

      <div className="content">
        {sidebarOpen && (
          <Sidebar
            index={index}
            currentId={currentId}
            onSelect={selectMap}
            onCreate={handleCreate}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onClose={() => setSidebarOpen(false)}
          />
        )}
        {view === 'board' ? (
          <MapView map={map} />
        ) : (
          <TextEditor
            map={map}
            onApply={(next) => applyModel(next)}
            onClose={() => setView('board')}
          />
        )}
        {importPayload && (
          <ImportDialog
            payload={importPayload}
            onConfirm={confirmImport}
            onCancel={() => setImportPayload(null)}
          />
        )}
      </div>
    </div>
  );
}
