import yaml from 'js-yaml';
import type { HypothesisMap } from '../types';
import type { ProjectFile, ProjectFileMap } from './storage';

/**
 * Импорт/экспорт карты (см. openspec/changes/add-web-app/specs/map-io):
 * JSON и YAML с автоопределением формата при парсинге. Группа карт
 * (проект) ездит одним файлом-обёрткой kind: 'hymap-project'.
 */

export type MapFormat = 'yaml' | 'json';

export type ParseResult = { ok: true; data: unknown } | { ok: false; error: string };

/** Собирает файл-проект: название + карты с их id хранилища
 *  (связи task.childMapId ссылаются на эти же id). */
export function buildProjectFile(title: string, maps: ProjectFileMap[]): ProjectFile {
  return { schemaVersion: 1, kind: 'hymap-project', project: { title }, maps };
}

/** Распознаёт файл-проект; null — обычная одиночная карта. */
export function asProjectFile(data: unknown): ProjectFile | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as { kind?: unknown; project?: unknown; maps?: unknown };
  if (d.kind !== 'hymap-project' || !Array.isArray(d.maps)) return null;
  const title =
    typeof d.project === 'object' &&
    d.project !== null &&
    typeof (d.project as { title?: unknown }).title === 'string'
      ? (d.project as { title: string }).title
      : 'Импортированный проект';
  const maps: ProjectFileMap[] = [];
  for (const m of d.maps) {
    if (typeof m !== 'object' || m === null) return null;
    const { id, map } = m as { id?: unknown; map?: unknown };
    if (typeof id !== 'string' || typeof map !== 'object' || map === null) return null;
    maps.push({ id, map: map as HypothesisMap });
  }
  return { schemaVersion: 1, kind: 'hymap-project', project: { title }, maps };
}

/** Парсит текст карты: сначала JSON, затем YAML. */
export function parseMapText(text: string): ParseResult {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false, error: 'пустой ввод' };

  if (trimmed.startsWith('{')) {
    try {
      return { ok: true, data: JSON.parse(trimmed) };
    } catch (e) {
      return { ok: false, error: `ошибка JSON: ${message(e)}` };
    }
  }
  try {
    return { ok: true, data: yaml.load(trimmed) };
  } catch (e) {
    return { ok: false, error: `ошибка YAML: ${message(e)}` };
  }
}

export function serializeMap(map: unknown, format: MapFormat): string {
  if (format === 'json') {
    return JSON.stringify(map, null, 2);
  }
  return yaml.dump(map, {
    lineWidth: 100,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });
}

function message(e: unknown): string {
  if (e instanceof yaml.YAMLException) {
    const mark = e.mark ? ` (строка ${e.mark.line + 1})` : '';
    return `${e.reason ?? 'синтаксическая ошибка'}${mark}`;
  }
  return e instanceof Error ? e.message : String(e);
}

/** Безопасное имя файла из названия карты. */
export function fileNameFor(title: string, format: MapFormat): string {
  const safe = title
    .replace(/[\\/:*?"<>|]+/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return `${safe || 'hypothesis-map'}.${format}`;
}

export function downloadTextFile(name: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
