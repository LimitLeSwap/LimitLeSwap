"use client";
import {
  createChart,
  ColorType,
  IChartApi,
  UTCTimestamp,
  ISeriesApi,
} from "lightweight-charts";
import React, { useEffect, useRef } from "react";
import { useHasMounted } from "@/lib/customHooks";

interface CandleData {
  time: string | UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface VolumeData {
  time: string | UTCTimestamp;
  value: number;
  color: string;
}

export default function priceChart({
  candleData,
  volumeData,
}: {
  candleData: CandleData[];
  volumeData: VolumeData[];
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const hasMounted = useHasMounted();

  const handleResize = () => {
    if (chartRef.current && chartContainerRef.current) {
      chartRef.current.applyOptions({
        width: chartContainerRef.current.clientWidth,
      });
    }
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#222" },
        textColor: "#DDD",
      },
      grid: {
        vertLines: { color: "#222" },
        horzLines: { color: "#444" },
      },
      width: 470,
      height: 300,
      timeScale: {
        timeVisible: true,
      },
    });
    const chartCandleSeries = chart.addCandlestickSeries();
    chartCandleSeries.applyOptions({
      wickUpColor: "rgb(54, 116, 217)",
      upColor: "rgb(54, 116, 217)",
      wickDownColor: "rgb(225, 50, 85)",
      downColor: "rgb(225, 50, 85)",
      borderVisible: false,
    });

    chartCandleSeries.priceScale().applyOptions({
      mode: 1, // logarithmic scale
      scaleMargins: {
        top: 0.2,
        bottom: 0.2,
      },
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "",
      lastValueVisible: false,
      priceLineVisible: false,
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.9,
        bottom: 0,
      },
    });

    chart.timeScale().applyOptions({
      borderColor: "#71649C",
    });

    chartRef.current = chart;
    seriesRef.current = chartCandleSeries;
    volumeSeriesRef.current = volumeSeries;
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [hasMounted]);

  useEffect(() => {
    if (!seriesRef.current || !volumeSeriesRef.current) return;

    if (candleData && candleData.length > 0) {
      seriesRef.current.setData(candleData);
    }

    if (volumeData && volumeData.length > 0) {
      volumeSeriesRef.current.setData(volumeData);
    }
  }, [candleData, volumeData]);

  return (
    <div className=" overflow-hidden rounded-2xl ">
      <div ref={chartContainerRef} style={{ width: "100%", height: "300px" }} />
    </div>
  );
}
