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

export const usePoolStore = create<PoolState, [["zustand/immer", never]]>(
  immer((set) => ({
    isSet: false,
    tokenList: [],
    poolList: [],
    positionList: [],

    setTokenList: (_tokenList: Token[]) => set({ tokenList: _tokenList }),
    setPoolList: (_poolList: Pool[]) => set({ poolList: _poolList }),
    setPositionList: (_positionList: Position[]) =>
      set({ positionList: _positionList }),
  })),
);
