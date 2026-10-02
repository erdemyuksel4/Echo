import { create } from 'zustand';
import type { AnnotationStroke } from '@echo/shared';

export type AnnotationToolType = 'pen' | 'arrow' | 'rect';

interface AnnotationStore {
  strokesByStream: Record<string, AnnotationStroke[]>;
  activeTool: AnnotationToolType;
  strokeColor: string;
  strokeWidth: number;
  isDrawingOpen: boolean;

  setTool: (tool: AnnotationToolType) => void;
  setColor: (color: string) => void;
  setWidth: (width: number) => void;
  toggleDrawingOpen: () => void;
  setDrawingOpen: (open: boolean) => void;

  addStroke: (streamUserId: string, stroke: AnnotationStroke) => void;
  addRemoteStroke: (streamUserId: string, stroke: AnnotationStroke) => void;
  undoLastStroke: (streamUserId: string) => AnnotationStroke | null;
  clearStrokes: (streamUserId: string) => void;
}

export const PRESET_COLORS = [
  '#ef4444', // Red
  '#f59e0b', // Amber/Yellow
  '#10b981', // Emerald/Green
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ffffff', // White
];

export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  strokesByStream: {},
  activeTool: 'pen',
  strokeColor: '#ef4444',
  strokeWidth: 3,
  isDrawingOpen: false,

  setTool: (activeTool) => set({ activeTool }),
  setColor: (strokeColor) => set({ strokeColor }),
  setWidth: (strokeWidth) => set({ strokeWidth }),
  toggleDrawingOpen: () => set((s) => ({ isDrawingOpen: !s.isDrawingOpen })),
  setDrawingOpen: (isDrawingOpen) => set({ isDrawingOpen }),

  addStroke: (streamUserId, stroke) => {
    set((state) => {
      const existing = state.strokesByStream[streamUserId] || [];
      return {
        strokesByStream: {
          ...state.strokesByStream,
          [streamUserId]: [...existing, stroke],
        },
      };
    });
  },

  addRemoteStroke: (streamUserId, stroke) => {
    set((state) => {
      const existing = state.strokesByStream[streamUserId] || [];
      // Prevent duplicate if stroke already added locally
      if (existing.some((s) => s.id === stroke.id)) {
        return state;
      }
      return {
        strokesByStream: {
          ...state.strokesByStream,
          [streamUserId]: [...existing, stroke],
        },
      };
    });
  },

  undoLastStroke: (streamUserId) => {
    const existing = get().strokesByStream[streamUserId] || [];
    if (existing.length === 0) return null;
    const last = existing[existing.length - 1];
    set((state) => ({
      strokesByStream: {
        ...state.strokesByStream,
        [streamUserId]: existing.slice(0, -1),
      },
    }));
    return last ?? null;
  },

  clearStrokes: (streamUserId) => {
    set((state) => ({
      strokesByStream: {
        ...state.strokesByStream,
        [streamUserId]: [],
      },
    }));
  },
}));
