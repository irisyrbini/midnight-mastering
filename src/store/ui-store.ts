import { create } from 'zustand';

type Panel = 'none' | 'pause' | 'journal' | 'settings';

type UiState = {
  openPanel: Panel;
  setOpenPanel: (panel: Panel) => void;
};

export const useUiStore = create<UiState>((set) => ({
  openPanel: 'none',
  setOpenPanel: (openPanel) => set({ openPanel }),
}));
