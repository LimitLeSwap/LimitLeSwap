import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export interface AppState {
  isMobile: boolean;

  setMobile: (isMobile: boolean) => void;
}

export const useAppStore = create<AppState>()(
  immer((set) => ({
    isMobile: false,

    setMobile: (isMobile) => set({ isMobile }),
  })),
);
