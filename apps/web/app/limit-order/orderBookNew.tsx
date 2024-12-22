"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLimitStore } from "@/lib/stores/limitStore";
import { DECIMALS } from "@/lib/constants";
import { useChainStore } from "@/lib/stores/chain";

interface OrderBookProps {
  sellToken: Token | null;
  buyToken: Token | null;
}

interface Order {
  price: number;
  quantity: number;
  total: number;
}

export default function OrderBook({ sellToken, buyToken }: OrderBookProps) {
  const limitStore = useLimitStore();
  const chainStore = useChainStore();

  const [asks, setAsks] = useState<Order[]>([]);
  const [bids, setBids] = useState<Order[]>([]);

  useEffect(() => {
    if (!sellToken || !buyToken) return;

    const currentBlockHeight = Number(chainStore.block?.height ?? 0);

    const processOrders = (isAsk: boolean): Order[] => {
      const relevantOrders = limitStore.limitOrders.filter((order) => {
        return (
          order.isActive &&
          Number(order.expiration) > currentBlockHeight &&
          (isAsk
            ? order.tokenIn === sellToken.tokenId &&
              order.tokenOut === buyToken.tokenId
            : order.tokenIn === buyToken.tokenId &&
              order.tokenOut === sellToken.tokenId)
        );
      });

      const priceToAmount: { [key: number]: number } = {};

      relevantOrders.forEach((order) => {
        const price = isAsk
          ? Number(order.tokenOutAmount) / Number(order.tokenInAmount)
          : Number(order.tokenInAmount) / Number(order.tokenOutAmount);
        const roundedPrice = Math.round(price * 100) / 100;
        const quantity = isAsk
          ? Number(order.tokenInAmount) / Number(DECIMALS)
          : Number(order.tokenOutAmount) / Number(DECIMALS);

        if (!priceToAmount[roundedPrice]) {
          priceToAmount[roundedPrice] = 0;
        }
        priceToAmount[roundedPrice] += quantity;
      });

      const transformedArray = Object.keys(priceToAmount)
        .map((key) => {
          const price = Number(key);
          const quantity = priceToAmount[price];
          const total = quantity * price;
          return { price, quantity, total };
        })
        .sort((a, b) => (isAsk ? a.price - b.price : b.price - a.price))
        .slice(0, 10);

      return transformedArray;
    };

    setAsks(processOrders(true).slice(0, 8));
    setBids(processOrders(false).slice(0, 8));
  }, [sellToken, buyToken, limitStore.limitOrders, chainStore.block]);

  const [baseDecimals, quoteDecimals] = (() => {
    return [6, 6];
  })();

  const baseFormatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: baseDecimals,
  });
  const quoteFormatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: quoteDecimals,
  });

  const maxAskTotal =
    asks.length > 0 ? Math.max(...asks.map((o) => o.total)) : 0;
  const maxBidTotal =
    bids.length > 0 ? Math.max(...bids.map((o) => o.total)) : 0;

  return (
    <Card className="w-full">
      <CardContent>
        <Table className="text-right">
          <TableHeader>
            <TableRow>
              <TableHead>Price ({buyToken?.name})</TableHead>
              <TableHead>Quantity ({sellToken?.name})</TableHead>
              <TableHead>Total ({buyToken?.name})</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {asks.map((order, index) => {
              const gradientPercentage = maxAskTotal
                ? (order.total / maxAskTotal) * 100
                : 0;
              return (
                <TableRow key={`ask-${index}`}>
                  <TableCell className="text-red-600">
                    {quoteFormatter.format(order.price)}
                  </TableCell>
                  <TableCell>{baseFormatter.format(order.quantity)}</TableCell>
                  <TableCell
                    className="relative"
                    style={{
                      background: `linear-gradient(to right, rgba(161, 6, 6, 0.3) ${gradientPercentage}%, transparent ${gradientPercentage}%)`,
                    }}
                  >
                    {quoteFormatter.format(order.total)}
                  </TableCell>
                </TableRow>
              );
            })}

            {bids.map((order, index) => {
              const gradientPercentage = maxBidTotal
                ? (order.total / maxBidTotal) * 100
                : 0;
              return (
                <TableRow key={`bid-${index}`}>
                  <TableCell className="text-green-600">
                    {quoteFormatter.format(order.price)}
                  </TableCell>
                  <TableCell>{baseFormatter.format(order.quantity)}</TableCell>
                  <TableCell
                    className="relative"
                    style={{
                      background: `linear-gradient(to right, rgba(4, 109, 4, 0.3) ${gradientPercentage}%, transparent ${gradientPercentage}%)`,
                    }}
                  >
                    {quoteFormatter.format(order.total)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
