import { create } from 'zustand';

import type { CaptureMode, OrgConfig, Report, ReportSummary } from '@/domain/types';
import { getFormat } from '@/domain/formats';
import * as vault from '@/storage/vault';
import { newId } from '@/util/id';
import { nowIso } from '@/util/time';

interface ReportState {
  summaries: ReportSummary[];
  loading: boolean;
  /** Report currently open in the capture/review flow. */
  current: Report | null;

  refresh: () => Promise<void>;
  startReport: (args: {
    org: OrgConfig;
    captureMode: CaptureMode;
    practiceMode: boolean;
  }) => Promise<Report>;
  open: (id: string) => Promise<Report | null>;
  /** Patch and persist the open report. Also refreshes the list. */
  update: (patch: Partial<Report>, event?: string) => Promise<Report | null>;
  remove: (id: string) => Promise<void>;
  eraseAll: () => Promise<void>;
  clearCurrent: () => void;
}

export const useReports = create<ReportState>((set, get) => ({
  summaries: [],
  loading: false,
  current: null,

  refresh: async () => {
    set({ loading: true });
    try {
      set({ summaries: await vault.loadIndex() });
    } finally {
      set({ loading: false });
    }
  },

  startReport: async ({ org, captureMode, practiceMode }) => {
    const now = nowIso();
    const report: Report = {
      id: newId(),
      createdAt: now,
      updatedAt: now,
      status: 'capturing',
      captureMode,
      practiceMode,
      rawInput: '',
      org: {
        id: org.id,
        name: org.name,
        formatId: org.formatId,
        formatLabel: getFormat(org.formatId).label,
      },
      followUps: [],
      history: [{ at: now, event: `Report started (${captureMode})` }],
    };
    await vault.saveReport(report);
    set({ current: report });
    await get().refresh();
    return report;
  },

  open: async (id) => {
    const report = await vault.loadReport(id);
    set({ current: report });
    return report;
  },

  update: async (patch, event) => {
    const current = get().current;
    if (!current) return null;

    const now = nowIso();
    const next: Report = {
      ...current,
      ...patch,
      updatedAt: now,
      history: event ? [...current.history, { at: now, event }] : current.history,
    };
    await vault.saveReport(next);
    set({ current: next });
    await get().refresh();
    return next;
  },

  remove: async (id) => {
    await vault.deleteReport(id);
    if (get().current?.id === id) set({ current: null });
    await get().refresh();
  },

  eraseAll: async () => {
    await vault.eraseAllData();
    set({ current: null, summaries: [] });
  },

  clearCurrent: () => set({ current: null }),
}));
