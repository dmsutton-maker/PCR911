import type { Directory } from 'expo-file-system';

import type { Report, ReportSummary } from '@/domain/types';
import { decryptJson, encryptJson, forgetCachedKey } from './crypto';
import { destroyDataKey } from './secure';

/**
 * Web fallback for the encrypted report vault.
 *
 * Metro picks this over vault.ts when building for web. Same API, backed by
 * localStorage rather than the filesystem — the browser filesystem APIs that
 * expo-file-system uses are inconsistently supported on mobile Safari, and
 * report bodies are small enough that localStorage is the simpler, more
 * reliable choice.
 *
 * ⚠️ Bodies are still run through AES-GCM for symmetry with the native build,
 * but the key lives in the same localStorage — so this is obfuscation, not
 * protection. See secure.web.ts. Practice data only.
 */

const INDEX_KEY = 'pcr.reports.index';
const REPORT_PREFIX = 'pcr.reports.body.';

function store(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function toSummary(report: Report): ReportSummary {
  const firstLine =
    report.rawInput
      .split('\n')
      .map((l) => l.replace(/^[-*•\s]+/, '').trim())
      .find((l) => l.length > 0) ?? '';

  return {
    id: report.id,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    status: report.status,
    captureMode: report.captureMode,
    practiceMode: report.practiceMode,
    preview: firstLine.slice(0, 120),
    openQuestionCount: report.followUps.filter((f) => f.state === 'open').length,
  };
}

export async function loadIndex(): Promise<ReportSummary[]> {
  const raw = store()?.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const list = await decryptJson<ReportSummary[]>(raw);
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

async function writeIndex(list: ReportSummary[]): Promise<void> {
  store()?.setItem(INDEX_KEY, await encryptJson(list));
}

export async function saveReport(report: Report): Promise<void> {
  store()?.setItem(`${REPORT_PREFIX}${report.id}`, await encryptJson(report));

  const index = await loadIndex();
  const next = [toSummary(report), ...index.filter((r) => r.id !== report.id)].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  await writeIndex(next);
}

export async function loadReport(id: string): Promise<Report | null> {
  const raw = store()?.getItem(`${REPORT_PREFIX}${id}`);
  if (!raw) return null;
  try {
    return await decryptJson<Report>(raw);
  } catch {
    return null;
  }
}

export async function deleteReport(id: string): Promise<void> {
  store()?.removeItem(`${REPORT_PREFIX}${id}`);
  const index = await loadIndex();
  await writeIndex(index.filter((r) => r.id !== id));
}

/** No local recordings exist in the web build; nothing to remove. */
export function deleteRecording(_uri: string): void {}

export async function eraseAllData(): Promise<void> {
  const s = store();
  if (s) {
    const doomed: string[] = [];
    for (let i = 0; i < s.length; i += 1) {
      const key = s.key(i);
      if (key && (key === INDEX_KEY || key.startsWith(REPORT_PREFIX))) doomed.push(key);
    }
    doomed.forEach((key) => s.removeItem(key));
  }
  await destroyDataKey();
  forgetCachedKey();
}

/** Audio capture is not supported in the web build — see app/capture/record.tsx. */
export function recordingsDir(): Directory {
  throw new Error('Audio recording is not available in the web version.');
}
