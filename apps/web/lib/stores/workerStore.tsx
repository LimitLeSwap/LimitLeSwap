import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface WorkerStoreState {
  isReady: boolean;
  worker: Worker | null;
  startWorker: () => Promise<void>;
  findRoute: (
    sourceToken: RouteToken,
    targetToken: RouteToken,
    rawInitialAmount: number,
    poolStore: PoolStoreState,
    limitStore: LimitStoreState,
  ) => Promise<CompleteRoute | null>;
}

async function timeout(seconds: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, seconds * 1000);
  });
}

export const useWorkerStore = create<
  WorkerStoreState,
  [["zustand/immer", never]]
>(
  immer((set) => ({
    isReady: false,
    worker: null,
    startWorker: async () => {
      const worker = new Worker(new URL("../routeWorker.ts", import.meta.url));

      set((state) => {
        state.isReady = true;
        state.worker = worker;
      });

      await timeout(5);
    },
    findRoute: async (
      sourceToken: RouteToken,
      targetToken: RouteToken,
      rawInitialAmount: number,
      poolStore: PoolStoreState,
      limitStore: LimitStoreState,
    ) => {
      return new Promise<CompleteRoute | null>((resolve) => {
        set((state) => {
          if (!state.worker) {
            console.error("Worker not ready");
            resolve(null);
            return;
          }

          state.worker.postMessage({
            sourceToken,
            targetToken,
            rawInitialAmount,
            poolStore,
            limitStore,
          });

          state.worker.onmessage = (event) => {
            resolve(event.data);
          };
        });
      });
    },
  })),
);
