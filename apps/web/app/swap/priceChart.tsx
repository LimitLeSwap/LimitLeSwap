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
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";

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

export default function PriceChart({
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

  const { theme } = useTheme();
  const hasMounted = useHasMounted();

  const getChartColors = (mode: string) => {
    return mode === "dark"
      ? {
          background: "#222",
          textColor: "#DDD",
          gridVert: "#222",
          gridHorz: "#444",
          borderColor: "#71649C",
          wickUp: "rgb(54, 116, 217)",
          upColor: "rgb(54, 116, 217)",
          wickDown: "rgb(225, 50, 85)",
          downColor: "rgb(225, 50, 85)",
        }
      : {
          background: "#fff",
          textColor: "#000",
          gridVert: "#e0e0e0",
          gridHorz: "#d0d0d0",
          borderColor: "#71649C",
          wickUp: "rgb(34, 197, 94)",
          upColor: "rgb(34, 197, 94)",
          wickDown: "rgb(239, 68, 68)",
          downColor: "rgb(239, 68, 68)",
        };
  };

  const applyTheme = () => {
    if (!chartRef.current) return;

    const colors = getChartColors(theme ?? "light");

    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.textColor,
      },
      grid: {
        vertLines: { color: colors.gridVert },
        horzLines: { color: colors.gridHorz },
      },
      timeScale: {
        borderColor: colors.borderColor,
      },
    });

    if (seriesRef.current) {
      seriesRef.current.applyOptions({
        wickUpColor: colors.wickUp,
        upColor: colors.upColor,
        wickDownColor: colors.wickDown,
        downColor: colors.downColor,
        borderVisible: false,
      });
    }
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const colors = getChartColors(theme ?? "light");

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.textColor,
      },
      grid: {
        vertLines: { color: colors.gridVert },
        horzLines: { color: colors.gridHorz },
      },
      width: 470,
      height: 300,
      timeScale: {
        timeVisible: true,
        borderColor: colors.borderColor,
      },
    });

    const chartCandleSeries = chart.addCandlestickSeries();
    chartCandleSeries.applyOptions({
      wickUpColor: colors.wickUp,
      upColor: colors.upColor,
      wickDownColor: colors.wickDown,
      downColor: colors.downColor,
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

    chartRef.current = chart;
    seriesRef.current = chartCandleSeries;
    volumeSeriesRef.current = volumeSeries;

    return () => {
      chart.remove();
    };
  }, [hasMounted]);

  useEffect(() => {
    applyTheme();
  }, [theme]);

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
    <Card className="overflow-hidden rounded-2xl shadow-none">
      <div ref={chartContainerRef} style={{ width: "100%", height: "300px" }} />
    </Card>
  );
}
