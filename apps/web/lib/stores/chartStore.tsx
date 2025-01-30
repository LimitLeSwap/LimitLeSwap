import { useEffect } from "react";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { useChainStore } from "./chain";
import { formatDate } from "../common";
import { UTCTimestamp } from "lightweight-charts";

export interface CandleDataResponse {
  data: {
    blockCandles: [
      {
        volumeT1: number;
        volumeT0: number;
        updatedAt: string;
        token1Id: string;
        token0Id: string;
        poolId: string;
        openT1: string;
        openT0: string;
        lowT1: string;
        lowT0: string;
        id: string;
        highT1: string;
        highT0: string;
        createdAt: string;
        closeT1: string;
        closeT0: string;
        blockHeight: number;
      },
    ];
  };
}

export interface ChartDataPoint {
  time: string | UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  value: number;
  color: string;
}

export interface ChartState {
  pool: Pool | null;
  chartData0: ChartDataPoint[];
  chartData1: ChartDataPoint[];

  setPool: (pool: Pool) => void;
  setChartData0: (chartData: ChartDataPoint[]) => void;
  setChartData1: (chartData: ChartDataPoint[]) => void;
}

export const useChartStore = create<ChartState, [["zustand/immer", never]]>(
  immer((set) => ({
    pool: null,
    chartData0: [],
    chartData1: [],

    setPool: (pool) => set({ pool }),
    setChartData0: (chartData) => set({ chartData0: chartData }),
    setChartData1: (chartData) => set({ chartData1: chartData }),
  })),
);

export const useObserveCandles = () => {
  const { pool, setChartData0, setChartData1 } = useChartStore();
  const chain = useChainStore();

  useEffect(() => {
    // console.log("Observing candles of pool", pool);
    if (pool === null) {
      return;
    }

    (async () => {
      const graphql = process.env.NEXT_PUBLIC_PROTOKIT_PROCESSOR_GRAPHQL_URL;

      if (graphql === undefined) {
        throw new Error(
          "Environment variable NEXT_PUBLIC_PROTOKIT_PROCESSOR_GRAPHQL_URL not set, can't execute graphql requests",
        );
      }

      const response = await fetch(graphql, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `query GetCandles {
  blockCandles(
    where: {poolId: {equals: "${pool.poolId}"}},
  ) {
    volumeT1
    volumeT0
    updatedAt
    token1Id
    token0Id
    poolId
    openT1
    openT0
    lowT1
    lowT0
    id
    highT1
    highT0
    createdAt
    closeT1
    closeT0
    blockHeight
  }
}`,
        }),
      });

      const { data } = (await response.json()) as CandleDataResponse;

      const chartData0 = data.blockCandles.map((candle) => ({
        time: formatDate(candle.createdAt).timestamp as UTCTimestamp,
        open: parseFloat(candle.openT0),
        high: parseFloat(candle.highT0),
        low: parseFloat(candle.lowT0),
        close: parseFloat(candle.closeT0),
        value: candle.volumeT0 / 1000000,
        color: candle.closeT0 > candle.openT0 ? "green" : "red",
      }));

      const chartData1 = data.blockCandles.map((candle) => ({
        time: formatDate(candle.createdAt).timestamp as UTCTimestamp,
        open: parseFloat(candle.openT1),
        high: parseFloat(candle.highT1),
        low: parseFloat(candle.lowT1),
        close: parseFloat(candle.closeT1),
        value: candle.volumeT1 / 1000000,
        color: candle.closeT1 > candle.openT1 ? "green" : "red",
      }));

      setChartData0(chartData0);
      setChartData1(chartData1);
    })();
  }, [pool, chain.block]);
};
