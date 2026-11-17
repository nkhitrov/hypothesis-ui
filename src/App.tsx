import { useMemo, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import type { HypothesisMap } from './types';
import {
  bootstrap,
  createMap,
  createProject,
  deleteMap,
  deleteProject,
  duplicateMap,
  importProject,
  isVolatile,
  loadIndex,
  loadMap,
  loadProjects,
  newId,
  saveCurrent,
  saveMap,
} from './model/storage';
import {
  asProjectFile,
  buildProjectFile,
  copyToClipboard,
  downloadTextFile,
  fileNameFor,
  parseMapText,
  serializeMap,
  type MapFormat,
} from './model/io';
import { validateMap } from './model/validate';
import { InvalidMapScreen } from './components/InvalidMapScreen';
import { MapView } from './components/MapView';
import { Sidebar } from './components/Sidebar';
import { TextEditor } from './components/TextEditor';
import { ImportDialog, type ImportPayload } from './components/ImportDialog';
import { ConfirmDialog } from './components/ConfirmDialog';

type View = 'board' | 'editor';

/** Пройденный путь переходов «задача → дочерняя карта» (для кнопки «← назад»). */
interface NavEntry {
  id: string;
  title: string;
}

export default function App() {
  const start = useMemo(() => bootstrap(), []);
  const [currentProjectId, setCurrentProjectId] = useState(start.currentProjectId);
  const [currentId, setCurrentId] = useState(start.currentId);
  const [map, setMap] = useState<HypothesisMap>(
    () => loadMap(start.currentId) ?? createMap('Новая карта', start.currentProjectId).map,
  );
  const [view, setView] = useState<View>('board');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [indexTick, setIndexTick] = useState(0);
  const [projectsTick, setProjectsTick] = useState(0);
  const [importPayload, setImportPayload] = useState<ImportPayload | null>(null);
  const [pendingDeleteMap, setPendingDeleteMap] = useState<string | null>(null);
  const [pendingDeleteProject, setPendingDeleteProject] = useState(false);
  const [navStack, setNavStack] = useState<NavEntry[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const projects = useMemo(() => loadProjects(), [projectsTick]);
  const index = useMemo(
    () => loadIndex().filter((e) => e.projectId === currentProjectId),
    [indexTick, currentProjectId],
  );

  /** Дочерние карты (task.childMapId) текущего проекта — для отступов в списке. */
  const childOf = useMemo(() => {
    const links = new Map<string, string>();
    for (const e of index) {
      const body = loadMap(e.id);
      for (const t of body?.tasks ?? []) {
        if (t.childMapId) links.set(t.childMapId, e.id);
      }
    }
    return links;
  }, [index]);

  /** Валидная карта — условие рендера: при ошибках доска не отрисовывается. */
  const validationErrors = useMemo(() => validateMap(map), [map]);

  /** Цели дочерних карт (childMapId → описание цели) — для плашек на задачах. */
  const childGoals = useMemo(() => {
    const goals: Record<string, string> = {};
    for (const t of map.tasks) {
      if (t.childMapId && !(t.childMapId in goals)) {
        goals[t.childMapId] = loadMap(t.childMapId)?.goal.description ?? '';
      }
    }
    return goals;
  }, [map]);

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

  /** Открыть карту (переход из списка или по задаче с childMapId).
   *  pushNav — запомнить текущую карту для кнопки «← назад». */
  const showMap = (id: string, pushNav: boolean): void => {
    const entry = loadIndex().find((e) => e.id === id);
    const loaded = loadMap(id);
    if (!entry || !loaded) {
      notify(`Карта «${id}» не найдена`);
      return;
    }
    if (pushNav) setNavStack((s) => [...s, { id: currentId, title: map.meta.title }]);
    setCurrentProjectId(entry.projectId);
    setCurrentId(id);
    setMap(loaded);
    saveCurrent({ projectId: entry.projectId, mapId: id });
    setSidebarOpen(false);
  };

  const selectMap = (id: string): void => {
    setNavStack([]);
    showMap(id, false);
  };

  /** Клик по задаче с дочерней картой (task.childMapId). */
  const openChildMap = (id: string): void => {
    const entry = loadIndex().find((e) => e.id === id);
    if (!entry) {
      notify(`Дочерняя карта «${id}» не найдена в хранилище`);
      return;
    }
    showMap(id, true);
  };

  const goBack = (): void => {
    const target = navStack[navStack.length - 1];
    if (!target) return;
    setNavStack((s) => s.slice(0, -1));
    showMap(target.id, false);
  };

  /** Сменить проект; в пустом проекте сразу появляется первая карта. */
  const selectProject = (projectId: string): void => {
    setCurrentProjectId(projectId);
    setNavStack([]);
    const first = loadIndex().find((e) => e.projectId === projectId);
    if (first) {
      setCurrentId(first.id);
      setMap(loadMap(first.id) ?? map);
      saveCurrent({ projectId, mapId: first.id });
    } else {
      const created = createMap('Новая карта 1', projectId);
      setCurrentId(created.id);
      setMap(created.map);
      saveCurrent({ projectId, mapId: created.id });
      setIndexTick((t) => t + 1);
    }
    setProjectsTick((t) => t + 1);
  };

  const handleCreateProject = (): void => {
    const created = createProject(`Новый проект ${projects.length + 1}`);
    selectProject(created.id);
    notify('Проект создан');
  };

  const handleDeleteProject = (): void => {
    setPendingDeleteProject(true);
  };

  const confirmDeleteProject = (): void => {
    setPendingDeleteProject(false);
    deleteProject(currentProjectId);
    setNavStack([]);
    setIndexTick((t) => t + 1);
    setProjectsTick((t) => t + 1);
    const remaining = loadProjects();
    if (remaining.length > 0) {
      selectProject(remaining[0]!.id);
    } else {
      const fresh = createProject('Мои карты');
      selectProject(fresh.id);
    }
    notify('Проект удалён');
  };

  const handleCreate = (): void => {
    const created = createMap(`Новая карта ${index.length + 1}`, currentProjectId);
    setCurrentId(created.id);
    setMap(created.map);
    setNavStack([]);
    saveCurrent({ projectId: currentProjectId, mapId: created.id });
    setIndexTick((t) => t + 1);
    notify('Карта создана');
  };

  const handleDuplicate = (id: string): void => {
    const copy = duplicateMap(id);
    if (!copy) return;
    const entry = loadIndex().find((e) => e.id === copy.id);
    setCurrentId(copy.id);
    setMap(copy.map);
    setNavStack([]);
    if (entry) saveCurrent({ projectId: entry.projectId, mapId: copy.id });
    setIndexTick((t) => t + 1);
    notify('Карта продублирована');
  };

  const handleDelete = (id: string): void => {
    setPendingDeleteMap(id);
  };

  const confirmDelete = (): void => {
    const id = pendingDeleteMap;
    setPendingDeleteMap(null);
    if (!id) return;
    deleteMap(id);
    setIndexTick((t) => t + 1);
    if (id === currentId) {
      const inProject = loadIndex().filter((e) => e.projectId === currentProjectId);
      if (inProject.length > 0) {
        setCurrentId(inProject[0]!.id);
        setMap(loadMap(inProject[0]!.id) ?? createMap('Новая карта', currentProjectId).map);
        saveCurrent({ projectId: currentProjectId, mapId: inProject[0]!.id });
      } else {
        const fresh = createMap('Новая карта', currentProjectId);
        setCurrentId(fresh.id);
        setMap(fresh.map);
        saveCurrent({ projectId: currentProjectId, mapId: fresh.id });
        setIndexTick((t) => t + 1);
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

  /** Проект одним файлом: все карты проекта со связями childMapId. */
  const exportProject = (): void => {
    const project = projects.find((p) => p.id === currentProjectId);
    const entries = loadIndex().filter((e) => e.projectId === currentProjectId);
    const file = buildProjectFile(
      project?.title ?? 'Проект',
      entries.map((e) => ({ id: e.id, map: loadMap(e.id)! })),
    );
    downloadTextFile(
      fileNameFor(`${project?.title ?? 'Проект'} (проект)`, 'yaml'),
      serializeMap(file, 'yaml'),
      'text/yaml',
    );
  };

  const copyAs = async (format: MapFormat): Promise<void> => {
    const ok = await copyToClipboard(serializeMap(map, format));
    notify(ok ? `Скопировано в буфер (${format.toUpperCase()})` : 'Не удалось скопировать');
  };

  /** Импорт: парсинг + распознавание (проект/карта) + валидация → диалог. */
  const ingest = (fileName: string, text: string): void => {
    const parsed = parseMapText(text);
    if (!parsed.ok) {
      setImportPayload({ fileName, data: null, errors: [parsed.error], project: null });
      return;
    }
    const projectFile = asProjectFile(parsed.data);
    if (projectFile) {
      if (projectFile.maps.length === 0) {
        setImportPayload({
          fileName,
          data: parsed.data,
          errors: ['файл проекта не содержит ни одной карты'],
          project: null,
        });
        return;
      }
      const errors = projectFile.maps.flatMap((m) =>
        validateMap(m.map).map((err) => `«${m.map.meta?.title ?? m.id}»: ${err}`),
      );
      setImportPayload({ fileName, data: parsed.data, errors, project: projectFile });
      return;
    }
    const errors = validateMap(parsed.data);
    setImportPayload({ fileName, data: parsed.data, errors, project: null });
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
      saveMap(id, incoming, currentProjectId);
      setCurrentId(id);
      setMap(incoming);
      setNavStack([]);
      saveCurrent({ projectId: currentProjectId, mapId: id });
      setIndexTick((t) => t + 1);
      notify('Импортирована новая карта');
    } else {
      applyModel(incoming);
      notify('Текущая карта заменена');
    }
    setImportPayload(null);
  };

  /** Импорт файла-проекта: заменить текущий или создать новый. */
  const confirmProjectImport = (replaceCurrent: boolean): void => {
    if (!importPayload?.project || importPayload.errors.length > 0) {
      setImportPayload(null);
      return;
    }
    const result = importProject(
      importPayload.project,
      replaceCurrent
        ? { replaceProjectId: currentProjectId }
        : { createWithTitle: importPayload.project.project.title },
    );
    setNavStack([]);
    setIndexTick((t) => t + 1);
    setProjectsTick((t) => t + 1);
    setCurrentProjectId(result.projectId);
    const firstId = result.mapIds[0]!;
    setCurrentId(firstId);
    setMap(loadMap(firstId)!);
    saveCurrent({ projectId: result.projectId, mapId: firstId });
    notify(replaceCurrent ? 'Проект заменён' : 'Проект импортирован');
    setImportPayload(null);
  };

  const onDrop = (e: ReactDragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  };

  const project = projects.find((p) => p.id === currentProjectId);
  const back = navStack[navStack.length - 1];

  return (
    <div className="app" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      <div className="topbar">
        <button className="btn" onClick={() => setSidebarOpen((v) => !v)} title="Список карт">
          ☰ Карты
        </button>
        <span className="brand">КАРТА ГИПОТЕЗ</span>
        {back && (
          <button
            className="btn back"
            onClick={goBack}
            title={`Вернуться к карте «${back.title}»`}
          >
            ← {back.title}
          </button>
        )}
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
        <button
          className="btn"
          onClick={exportProject}
          title={`Все карты проекта «${project?.title ?? ''}» одним файлом`}
        >
          ↓ Проект
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
            projects={projects}
            currentProjectId={currentProjectId}
            onSelectProject={selectProject}
            onCreateProject={handleCreateProject}
            onDeleteProject={handleDeleteProject}
            index={index}
            currentId={currentId}
            childOf={childOf}
            onSelect={selectMap}
            onCreate={handleCreate}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onClose={() => setSidebarOpen(false)}
          />
        )}
        {view === 'board' ? (
          validationErrors.length > 0 ? (
            <InvalidMapScreen
              errors={validationErrors}
              onFix={() => setView('editor')}
              onOpenList={() => setSidebarOpen(true)}
            />
          ) : (
            <MapView map={map} childGoals={childGoals} onOpenMap={openChildMap} />
          )
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
            onConfirmMap={confirmImport}
            onConfirmProject={confirmProjectImport}
            onCancel={() => setImportPayload(null)}
          />
        )}
        {pendingDeleteMap && (
          <ConfirmDialog
            title="Удалить карту?"
            body={`Карта «${
              loadIndex().find((e) => e.id === pendingDeleteMap)?.title ?? pendingDeleteMap
            }» будет удалена безвозвратно.`}
            confirmLabel="Удалить"
            onConfirm={confirmDelete}
            onCancel={() => setPendingDeleteMap(null)}
          />
        )}
        {pendingDeleteProject && (
          <ConfirmDialog
            title="Удалить проект?"
            body={`Проект «${project?.title ?? ''}» и все его карты (${
              loadIndex().filter((e) => e.projectId === currentProjectId).length
            }) будут удалены безвозвратно.`}
            confirmLabel="Удалить проект"
            onConfirm={confirmDeleteProject}
            onCancel={() => setPendingDeleteProject(false)}
          />
        )}
      </div>
    </div>
  );
}
