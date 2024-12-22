"use client";
import React, { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { usePoolStore } from "@/lib/stores/poolStore";
import { useLimitStore } from "@/lib/stores/limitStore";
import { useChainStore } from "@/lib/stores/chain";
import { DECIMALS } from "@/lib/constants";

const chartConfig = {
  amount: {
    label: "Amount",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export default function OrderBook({
  sellToken,
  buyToken,
}: {
  sellToken: Token | null;
  buyToken: Token | null;
}) {
  const poolStore = usePoolStore();
  const limitStore = useLimitStore();
  const chainStore = useChainStore();
  const [orders, setOrders] = useState<{ price: string; amount: number }[]>([]);

  useEffect(() => {
    if (!sellToken || !buyToken) return;

    const priceToAmount: { [key: number]: number } = {};

    limitStore.limitOrders
      .filter((order) => {
        return (
          order.isActive &&
          Number(order.expiration) > Number(chainStore.block?.height ?? 0) &&
          order.tokenIn === sellToken?.tokenId &&
          order.tokenOut === buyToken?.tokenId
        );
      })
      .map((order) => {
        return {
          price: Number(order.tokenOutAmount) / Number(order.tokenInAmount),
          amountIn: Number(order.tokenInAmount),
        };
      })
      .forEach((order) => {
        const roundedPrice = Math.round(order.price * 100) / 100;
        if (!priceToAmount[roundedPrice]) {
          priceToAmount[roundedPrice] = 0;
        }
        priceToAmount[roundedPrice] += order.amountIn / Number(DECIMALS);
      });

    const transformedArray = Object.keys(priceToAmount)
      .map((key) => {
        return {
          price: Number(key).toFixed(2),
          amount: priceToAmount[Number(key)],
        };
      })
      .sort((a, b) => Number(a.price) - Number(b.price))
      .slice(0, 10);

    setOrders(transformedArray);
  }, [sellToken, buyToken, limitStore.limitOrders]);

  return (
    <Card className=" w-full rounded-2xl shadow-none">
      <CardHeader>
        <CardTitle className=" flex flex-row items-center justify-center text-xl">
          {" "}
          <div className="relative flex h-4 w-8">
            <div className=" absolute top-0">
              <img src={sellToken?.icon} className="h-4 w-4" />
            </div>
            <div className=" absolute left-2">
              <img src={buyToken?.icon} className="h-4 w-4" />
            </div>
          </div>
          <span className="flex">
            {sellToken?.name} / {buyToken?.name} Orders
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length > 0 ? (
          <ChartContainer config={chartConfig}>
            <BarChart
              accessibilityLayer
              data={orders}
              layout="vertical"
              margin={{
                top: 20,
                right: 30,
                left: 40,
                bottom: 20,
              }}
            >
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="price"
                type="category"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => value.slice(0, 3)}
                hide
              />
              <XAxis dataKey="amount" type="number" hide />
              <ChartTooltip
                cursor={true}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(value) =>
                      value + ` ${buyToken?.name} / ${sellToken?.name}`
                    }
                    formatter={(value) => value + ` ${buyToken?.name}`}
                    hideIndicator={false}
                  />
                }
              />
              <Bar
                dataKey="amount"
                layout="vertical"
                fill="hsl(142.1 76.2% 36.3%)"
                radius={4}
              >
                <LabelList
                  dataKey="price"
                  position="insideLeft"
                  offset={2}
                  className="fill-[--color-label]"
                  fontSize={10}
                />
                <LabelList
                  dataKey="amount"
                  position="right"
                  offset={4}
                  className="overflow-visible fill-foreground"
                  fontSize={10}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-zinc-500">No orders available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
