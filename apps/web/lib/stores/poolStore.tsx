import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export interface PoolState {
  isSet: boolean;
  tokenList: Token[];
  poolList: Pool[];
  positionList: Position[];

  setTokenList: (tokenList: Token[]) => void;
  setPoolList: (poolList: Pool[]) => void;

  setPositionList: (positionList: Position[]) => void;
}

export const usePoolStore = create<PoolState>()(
  immer((set) => ({
    isSet: false,
    tokenList: [],
    poolList: [],
    positionList: [],

    setTokenList: (tokenList) => set({ tokenList }),
    setPoolList: (poolList) => set({ poolList }),
    setPositionList: (positionList) => set({ positionList }),
  })),
);
