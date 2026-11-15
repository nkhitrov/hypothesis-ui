import type { HypothesisMap } from '../types';
import { DEMO_MAP } from './seed';

/**
 * Хранение карт в localStorage (см. openspec/changes/add-web-app/specs/map-storage):
 * индекс hymap:index + тела hymap:map:<id>. Идентификатор карты живёт на уровне
 * хранилища (не в документе) — переименование не меняет id. При недоступном
 * localStorage карта работает в памяти: данные не переживут перезагрузку,
 * UI показывает предупреждение.
 */

const INDEX_KEY = 'hymap:index';
const MAP_PREFIX = 'hymap:map:';

export interface MapIndexEntry {
  id: string;
  title: string;
  updatedAt: number;
}

const memoryMaps = new Map<string, HypothesisMap>();
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
  return [...memoryMaps.entries()].map(([id, m]) => ({
    id,
    title: m.meta.title,
    updatedAt: 0,
  }));
}

function sortIndex(index: MapIndexEntry[]): MapIndexEntry[] {
  return [...index].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
}

function writeIndex(index: MapIndexEntry[]): void {
  const sorted = sortIndex(index);
  if (checkStorage()) {
    try {
      window.localStorage.setItem(INDEX_KEY, JSON.stringify(sorted));
    } catch {
      // квота исчерпана: текущая сессия продолжает работать в памяти
    }
  }
}

export function loadMap(id: string): HypothesisMap | null {
  if (!checkStorage()) return memoryMaps.get(id) ?? null;
  try {
    const raw = window.localStorage.getItem(MAP_PREFIX + id);
    return raw ? (JSON.parse(raw) as HypothesisMap) : null;
  } catch {
    return null;
  }
}

/** Записывает карту под данным id и обновляет индекс (автосохранение). */
export function saveMap(id: string, map: HypothesisMap): void {
  if (!checkStorage()) {
    memoryMaps.set(id, map);
    return;
  }
  try {
    window.localStorage.setItem(MAP_PREFIX + id, JSON.stringify(map));
  } catch {
    // квота: данные живут в памяти до конца сессии
    memoryMaps.set(id, map);
  }
  writeIndex([
    ...loadIndex().filter((e) => e.id !== id),
    { id, title: map.meta.title, updatedAt: Date.now() },
  ]);
}

export function deleteMap(id: string): void {
  memoryMaps.delete(id);
  if (!checkStorage()) return;
  window.localStorage.removeItem(MAP_PREFIX + id);
  writeIndex(loadIndex().filter((e) => e.id !== id));
}

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

/** Создаёт и сохраняет новую пустую карту. */
export function createMap(title: string): { id: string; map: HypothesisMap } {
  const id = newId();
  const map = emptyMap(title);
  saveMap(id, map);
  return { id, map };
}

/** Дублирует карту: новое имя «<название> (копия)», новый id. */
export function duplicateMap(id: string): { id: string; map: HypothesisMap } | null {
  const source = loadMap(id);
  if (!source) return null;
  const copy = structuredClone(source);
  copy.meta.title = `${source.meta.title} (копия)`;
  const newMapId = newId();
  saveMap(newMapId, copy);
  return { id: newMapId, map: copy };
}

/** Первый запуск: пустое хранилище → предзагрузка демо-карты. */
export function bootstrap(): { index: MapIndexEntry[]; currentId: string } {
  let index = loadIndex();
  if (index.length === 0) {
    const id = 'demo-smennsy-pro';
    saveMap(id, structuredClone(DEMO_MAP));
    index = loadIndex();
  }
  return { index, currentId: index[0]!.id };
}
