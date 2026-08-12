import { Directory, File, Paths } from 'expo-file-system';

import type { Report, ReportSummary } from '@/domain/types';
import { decryptJson, encryptJson, forgetCachedKey } from './crypto';
import { destroyDataKey } from './secure';

/**
 * Encrypted, local-only report storage.
 *
 * Layout under the app's document directory (which is excluded from iCloud
 * backup for these files by virtue of the key being device-only):
 *
 *   reports/index.enc      encrypted array of ReportSummary
 *   reports/<id>.enc       encrypted Report body
 *   recordings/<id>.m4a    raw audio for live-capture reports
 *
 * Nothing here ever leaves the device. The only outbound network call in the
 * whole app is the explicit Claude request in src/ai/client.ts.
 */

const REPORTS_DIR = 'reports';
const RECORDINGS_DIR = 'recordings';
const INDEX_NAME = 'index.enc';

function reportsDir(): Directory {
  const dir = new Directory(Paths.document, REPORTS_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export function recordingsDir(): Directory {
  const dir = new Directory(Paths.document, RECORDINGS_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function indexFile(): File {
  return new File(reportsDir(), INDEX_NAME);
}

function reportFile(id: string): File {
  return new File(reportsDir(), `${id}.enc`);
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
  const file = indexFile();
  if (!file.exists) return [];
  try {
    const list = await decryptJson<ReportSummary[]>(await file.text());
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    // A corrupt or undecryptable index (e.g. after the data key was destroyed)
    // must not brick the app. Report an empty list; bodies stay on disk until
    // the user erases them explicitly.
    return [];
  }
}

async function writeIndex(list: ReportSummary[]): Promise<void> {
  const file = indexFile();
  if (!file.exists) file.create({ intermediates: true, overwrite: true });
  file.write(await encryptJson(list));
}

export async function saveReport(report: Report): Promise<void> {
  const file = reportFile(report.id);
  if (!file.exists) file.create({ intermediates: true, overwrite: true });
  file.write(await encryptJson(report));

  const index = await loadIndex();
  const summary = toSummary(report);
  const next = [summary, ...index.filter((r) => r.id !== report.id)].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  await writeIndex(next);
}

export async function loadReport(id: string): Promise<Report | null> {
  const file = reportFile(id);
  if (!file.exists) return null;
  try {
    return await decryptJson<Report>(await file.text());
  } catch {
    return null;
  }
}

export async function deleteReport(id: string): Promise<void> {
  const report = await loadReport(id);
  if (report?.audioUri) deleteRecording(report.audioUri);

  const file = reportFile(id);
  if (file.exists) file.delete();

  const index = await loadIndex();
  await writeIndex(index.filter((r) => r.id !== id));
}

export function deleteRecording(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A missing recording is not an error worth surfacing — the report body,
    // which is the thing that matters, is unaffected.
  }
}

/**
 * Crypto-shred: delete every report file, every recording, and the data key.
 * Even if the raw files were recovered from a disk image afterwards, they are
 * unreadable without the destroyed key.
 */
export async function eraseAllData(): Promise<void> {
  const reports = new Directory(Paths.document, REPORTS_DIR);
  if (reports.exists) reports.delete();

  const recordings = new Directory(Paths.document, RECORDINGS_DIR);
  if (recordings.exists) recordings.delete();

  await destroyDataKey();
  forgetCachedKey();
}
