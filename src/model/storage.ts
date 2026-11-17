import type { HypothesisMap } from '../types';
import { DEMO_MAPS } from './seed';

/**
 * Хранение карт в localStorage (см. openspec/changes/add-web-app/specs/map-storage):
 * индекс hymap:index + тела hymap:map:<id>; карты сгруппированы в проекты
 * (hymap:projects). Идентификатор карты живёт на уровне хранилища (не в
 * документе) — переименование не меняет id; связи между картами
 * (task.childMapId) ссылаются на эти же id. Выбранный проект и карта
 * запоминаются (hymap:current) и переживают перезагрузку. При недоступном
 * localStorage всё живёт в памяти: данные не переживут перезагрузку,
 * UI показывает предупреждение.
 */

const INDEX_KEY = 'hymap:index';
const PROJECTS_KEY = 'hymap:projects';
const CURRENT_KEY = 'hymap:current';
const VIEWPORTS_KEY = 'hymap:viewports';
const MAP_PREFIX = 'hymap:map:';

export interface MapIndexEntry {
  id: string;
  title: string;
  updatedAt: number;
  /** Проект, которому принадлежит карта. */
  projectId: string;
}

export interface ProjectEntry {
  id: string;
  title: string;
  updatedAt: number;
}

/** Файл-проект (экспорт/импорт группой, см. io.ts). */
export interface ProjectFileMap {
  id: string;
  map: HypothesisMap;
}
export interface ProjectFile {
  schemaVersion: 1;
  kind: 'hymap-project';
  project: { title: string };
  maps: ProjectFileMap[];
}

export interface CurrentSelection {
  projectId: string;
  mapId: string;
}

const memoryMaps = new Map<string, { map: HypothesisMap; projectId: string }>();
const memoryProjects = new Map<string, ProjectEntry>();
let storageAvailable: boolean | null = null;

/** localStorage может быть недоступен (приватный режим, квота). */
function checkStorage(): boolean {
  if (storageAvailable !== null) return storageAvailable;
  try {
    const probe = '__hymap_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  return storageAvailable;
}

/** True — данные живут только в памяти текущей сессии. */
export function isVolatile(): boolean {
  return !checkStorage();
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

// ---------- Проекты ----------

export function loadProjects(): ProjectEntry[] {
  if (!checkStorage()) {
    return [...memoryProjects.values()].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  }
  try {
    const raw = window.localStorage.getItem(PROJECTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as ProjectEntry[]) : [];
    return Array.isArray(parsed) ? parsed.sort((a, b) => a.title.localeCompare(b.title, 'ru')) : [];
  } catch {
    return [];
  }
}

function writeProjects(projects: ProjectEntry[]): void {
  const sorted = [...projects].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  if (checkStorage()) {
    try {
      window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(sorted));
    } catch {
      // квота: продолжаем в памяти
    }
  }
}

/** Создаёт и сохраняет новый пустой проект. */
export function createProject(title: string): ProjectEntry {
  const entry: ProjectEntry = { id: newId(), title, updatedAt: Date.now() };
  memoryProjects.set(entry.id, entry);
  writeProjects([...loadProjects(), entry]);
  return entry;
}

/** Удаляет проект и все его карты. */
export function deleteProject(projectId: string): void {
  for (const entry of loadIndex()) {
    if (entry.projectId === projectId) deleteMap(entry.id);
  }
  memoryProjects.delete(projectId);
  if (checkStorage()) {
    try {
      writeProjects(loadProjects().filter((p) => p.id !== projectId));
    } catch {
      // память
    }
  }
}

// ---------- Индекс карт ----------

export function loadIndex(): MapIndexEntry[] {
  if (!checkStorage()) return memoryIndex();
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    const parsed = raw ? (JSON.parse(raw) as MapIndexEntry[]) : [];
    return Array.isArray(parsed) ? sortIndex(parsed) : [];
  } catch {
    return [];
  }
}

function memoryIndex(): MapIndexEntry[] {
  return [...memoryMaps.entries()].map(([id, { map, projectId }]) => ({
    id,
    title: map.meta.title,
    updatedAt: 0,
    projectId,
  }));
}

function sortIndex(index: MapIndexEntry[]): MapIndexEntry[] {
  return [...index].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
}

function writeIndex(index: MapIndexEntry[]): void {
  const sorted = sortIndex(index);
  memoryMaps.forEach((value, id) => {
    const entry = sorted.find((e) => e.id === id);
    if (entry) value.projectId = entry.projectId;
  });
  if (checkStorage()) {
    try {
      window.localStorage.setItem(INDEX_KEY, JSON.stringify(sorted));
    } catch {
      // квота исчерпана: текущая сессия продолжает работать в памяти
    }
  }
}

// ---------- Тела карт ----------

export function loadMap(id: string): HypothesisMap | null {
  if (!checkStorage()) return memoryMaps.get(id)?.map ?? null;
  try {
    const raw = window.localStorage.getItem(MAP_PREFIX + id);
    return raw ? (JSON.parse(raw) as HypothesisMap) : null;
  } catch {
    return null;
  }
}

/** Записывает карту под данным id и обновляет индекс (автосохранение).
 *  projectId опущен — принадлежность проекту не меняется. */
export function saveMap(id: string, map: HypothesisMap, projectId?: string): void {
  const known = loadIndex().find((e) => e.id === id);
  const owner = projectId ?? known?.projectId ?? '';
  if (!checkStorage()) {
    memoryMaps.set(id, { map, projectId: owner });
    return;
  }
  try {
    window.localStorage.setItem(MAP_PREFIX + id, JSON.stringify(map));
  } catch {
    // квота: данные живут в памяти до конца сессии
    memoryMaps.set(id, { map, projectId: owner });
  }
  writeIndex([
    ...loadIndex().filter((e) => e.id !== id),
    { id, title: map.meta.title, updatedAt: Date.now(), projectId: owner },
  ]);
}

export function deleteMap(id: string): void {
  memoryMaps.delete(id);
  memoryViewports.delete(id);
  if (!checkStorage()) return;
  window.localStorage.removeItem(MAP_PREFIX + id);
  writeIndex(loadIndex().filter((e) => e.id !== id));
  // сохранённая область просмотра карты больше не нужна
  try {
    const all = JSON.parse(window.localStorage.getItem(VIEWPORTS_KEY) ?? '{}');
    if (id in all) {
      delete all[id];
      window.localStorage.setItem(VIEWPORTS_KEY, JSON.stringify(all));
    }
  } catch {
    // память
  }
}

// ---------- Область просмотра карты (закрепляется за каждой картой своя) ----------

/** Позиция/масштаб доски {x, y, zoom} — совместимо с Viewport React Flow. */
export interface ViewportBox {
  x: number;
  y: number;
  zoom: number;
}

const memoryViewports = new Map<string, ViewportBox>();

export function loadViewport(mapId: string): ViewportBox | null {
  if (!checkStorage()) return memoryViewports.get(mapId) ?? null;
  try {
    const all = JSON.parse(window.localStorage.getItem(VIEWPORTS_KEY) ?? '{}');
    const vp = all?.[mapId];
    return typeof vp?.x === 'number' && typeof vp?.y === 'number' && typeof vp?.zoom === 'number'
      ? (vp as ViewportBox)
      : null;
  } catch {
    return null;
  }
}

export function saveViewport(mapId: string, vp: ViewportBox): void {
  if (!checkStorage()) {
    memoryViewports.set(mapId, vp);
    return;
  }
  try {
    const all = JSON.parse(window.localStorage.getItem(VIEWPORTS_KEY) ?? '{}');
    all[mapId] = vp;
    window.localStorage.setItem(VIEWPORTS_KEY, JSON.stringify(all));
  } catch {
    memoryViewports.set(mapId, vp);
  }
}

// ---------- Текущий выбор (переживает перезагрузку) ----------

export function saveCurrent(selection: CurrentSelection): void {
  if (!checkStorage()) return;
  try {
    window.localStorage.setItem(CURRENT_KEY, JSON.stringify(selection));
  } catch {
    // память: выбор живёт только в стейте приложения
  }
}

export function loadCurrent(): CurrentSelection | null {
  if (!checkStorage()) return null;
  try {
    const raw = window.localStorage.getItem(CURRENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as CurrentSelection) : null;
    return parsed && typeof parsed.projectId === 'string' && typeof parsed.mapId === 'string'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

// ---------- Заготовки ----------

/** Минимальная валидная карта-заготовка. */
export function emptyMap(title: string): HypothesisMap {
  return {
    schemaVersion: 1,
    meta: { title, version: 1, date: new Date().toISOString().slice(0, 10) },
    goal: { id: 'goal', description: 'Опишите цель', metrics: [] },
    subjects: [],
    hypotheses: [],
    tasks: [],
    blockers: [],
  };
}

/** Создаёт и сохраняет новую пустую карту в проекте. */
export function createMap(title: string, projectId: string): { id: string; map: HypothesisMap } {
  const id = newId();
  const map = emptyMap(title);
  saveMap(id, map, projectId);
  return { id, map };
}

/** Дублирует карту в том же проекте: «<название> (копия)», новый id. */
export function duplicateMap(id: string): { id: string; map: HypothesisMap } | null {
  const known = loadIndex().find((e) => e.id === id);
  const source = loadMap(id);
  if (!source || !known) return null;
  const copy = structuredClone(source);
  copy.meta.title = `${source.meta.title} (копия)`;
  const newMapId = newId();
  saveMap(newMapId, copy, known.projectId);
  return { id: newMapId, map: copy };
}

// ---------- Импорт проекта ----------

/** Сохраняет карты файла в проект; коллизии id (с существующими картами и
 *  дубли внутри файла) разводятся новыми id с перепривязкой task.childMapId —
 *  переходы между картами группы не рвутся. */
export function importProject(
  file: ProjectFile,
  mode: { replaceProjectId: string } | { createWithTitle: string },
): { projectId: string; mapIds: string[] } {
  const projectId =
    'replaceProjectId' in mode ? mode.replaceProjectId : createProject(mode.createWithTitle).id;
  if ('replaceProjectId' in mode) {
    for (const entry of loadIndex()) {
      if (entry.projectId === projectId) deleteMap(entry.id);
    }
  }
  // 1) развести id (занятые в хранилище и повторяющиеся в файле)
  const taken = new Set(loadIndex().map((e) => e.id));
  const renames = new Map<string, string>();
  const ids: string[] = [];
  for (const e of file.maps) {
    let id = e.id;
    if (taken.has(id) || ids.includes(id)) {
      do {
        id = newId();
      } while (taken.has(id) || ids.includes(id));
      renames.set(e.id, id);
    }
    taken.add(id);
    ids.push(id);
  }
  // 2) сохранить тела, перепривязав ссылки на переименованные карты
  file.maps.forEach((e, i) => {
    const body = structuredClone(e.map);
    if (renames.size > 0) {
      for (const t of body.tasks) {
        if (t.childMapId && renames.has(t.childMapId)) t.childMapId = renames.get(t.childMapId);
      }
    }
    saveMap(ids[i]!, body, projectId);
  });
  return { projectId, mapIds: ids };
}

// ---------- Запуск ----------

/** Старое хранилище без проектов: все карты уходят в проект «Мои карты». */
function ensureProjects(): void {
  if (loadProjects().length > 0) return;
  createProject('Мои карты');
  const owner = loadProjects().find((p) => p.title === 'Мои карты')!;
  writeIndex(loadIndex().map((e) => ({ ...e, projectId: owner.id })));
}

/** Первый запуск: пустое хранилище → предзагрузка демо-карт одним проектом
 *  (основная — «Притча о гончаре», пример из базы знаний). Выбранные проект
 *  и карта восстанавливаются из hymap:current. */
export function bootstrap(): {
  projects: ProjectEntry[];
  index: MapIndexEntry[];
  currentProjectId: string;
  currentId: string;
} {
  let index = loadIndex();
  if (index.length === 0) {
    const demo = createProject('Демо из базы знаний');
    for (const d of DEMO_MAPS) {
      saveMap(d.id, structuredClone(d.map), demo.id);
    }
    index = loadIndex();
  }
  ensureProjects();
  const projects = loadProjects();
  index = loadIndex();

  const saved = loadCurrent();
  const currentProjectId =
    saved && projects.some((p) => p.id === saved.projectId)
      ? saved.projectId
      : (projects[0]?.id ?? '');
  const inProject = index.filter((e) => e.projectId === currentProjectId);
  const currentId =
    saved && inProject.some((e) => e.id === saved.mapId)
      ? saved.mapId
      : (inProject.find((e) => e.id === 'demo-gonchar') ?? inProject[0] ?? index[0])!.id;
  return { projects, index, currentProjectId, currentId };
}
