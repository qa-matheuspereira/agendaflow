import { create } from 'zustand';
import type { QueueState, QueueEntryPublic } from '@agendaflow/shared';

interface QueueStoreState {
  queueState: QueueState | null;
  isConnected: boolean;
  setQueueState: (state: QueueState) => void;
  addEntry: (entry: QueueEntryPublic) => void;
  updateEntry: (entry: QueueEntryPublic) => void;
  removeEntry: (entryId: string) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

export const useQueueStore = create<QueueStoreState>((set) => ({
  queueState: null,
  isConnected: false,

  setQueueState: (state) => set({ queueState: state }),

  addEntry: (entry) =>
    set((prev) => {
      if (!prev.queueState) return prev;
      return {
        queueState: {
          ...prev.queueState,
          entries: [...prev.queueState.entries, entry],
          totalWaiting: prev.queueState.totalWaiting + 1,
          updatedAt: new Date().toISOString(),
        },
      };
    }),

  updateEntry: (entry) =>
    set((prev) => {
      if (!prev.queueState) return prev;
      return {
        queueState: {
          ...prev.queueState,
          entries: prev.queueState.entries.map((e) => (e.id === entry.id ? entry : e)),
          updatedAt: new Date().toISOString(),
        },
      };
    }),

  removeEntry: (entryId) =>
    set((prev) => {
      if (!prev.queueState) return prev;
      return {
        queueState: {
          ...prev.queueState,
          entries: prev.queueState.entries.filter((e) => e.id !== entryId),
          totalWaiting: Math.max(0, prev.queueState.totalWaiting - 1),
          updatedAt: new Date().toISOString(),
        },
      };
    }),

  setConnected: (connected) => set({ isConnected: connected }),

  reset: () => set({ queueState: null, isConnected: false }),
}));
