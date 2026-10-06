// Isolated Local Draft Storage for uncommitted forms & work in progress
// Ensures that browser refresh (F5), tab close, or instant syncs NEVER erase user drafts.

import { safeStorage } from './storage';

const DRAFT_PREFIX = 'orca_draft_';

export interface FormDraftMetadata {
  formId: string;
  savedAt: string;
  data: any;
}

export const formDraftStorage = {
  saveDraft: (formId: string, data: any): void => {
    try {
      if (!data || Object.keys(data).length === 0) {
        return;
      }
      const payload: FormDraftMetadata = {
        formId,
        savedAt: new Date().toISOString(),
        data,
      };
      safeStorage.setItem(`${DRAFT_PREFIX}${formId}`, JSON.stringify(payload));
    } catch {
      // Safe fallback
    }
  },

  getDraft: <T = any>(formId: string): { data: T; savedAt: string } | null => {
    try {
      const raw = safeStorage.getItem(`${DRAFT_PREFIX}${formId}`);
      if (!raw) return null;
      const parsed: FormDraftMetadata = JSON.parse(raw);
      if (parsed && parsed.data) {
        return {
          data: parsed.data as T,
          savedAt: parsed.savedAt,
        };
      }
    } catch {
      // ignore
    }
    return null;
  },

  clearDraft: (formId: string): void => {
    try {
      safeStorage.removeItem(`${DRAFT_PREFIX}${formId}`);
    } catch {
      // ignore
    }
  },

  hasDraft: (formId: string): boolean => {
    return !!safeStorage.getItem(`${DRAFT_PREFIX}${formId}`);
  },
};
