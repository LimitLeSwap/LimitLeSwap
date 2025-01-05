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
      return limitStore.limitOrders
        .filter((order) => {
          return isAsk
            ? order.tokenInId === sellToken.tokenId &&
                order.tokenOutId === buyToken.tokenId
            : order.tokenInId === buyToken.tokenId &&
                order.tokenOutId === sellToken.tokenId;
        })
        .map((order) => {
          return {
            price: isAsk
              ? Math.round(
                  (Number(order.tokenOutAmount) / Number(order.tokenInAmount)) *
                    100,
                ) / 100
              : Math.round(
                  (Number(order.tokenInAmount) / Number(order.tokenOutAmount)) *
                    100,
                ) / 100,
            quantity: isAsk
              ? Number(order.tokenInAmount) / Number(DECIMALS)
              : Number(order.tokenOutAmount) / Number(DECIMALS),
            total: isAsk
              ? Number(order.tokenOutAmount) / Number(DECIMALS)
              : Number(order.tokenInAmount) / Number(DECIMALS),
          };
        })
        .sort((a, b) => (isAsk ? a.price - b.price : b.price - a.price))
        .slice(0, 8);
    };

    setAsks(processOrders(true).slice(0, 8));
    setBids(processOrders(false).slice(0, 8));
  }, [sellToken, buyToken, limitStore.limitOrders, chainStore.block]);

  const maxAskTotal =
    asks.length > 0 ? Math.max(...asks.map((o) => o.total)) : 0;
  const maxBidTotal =
    bids.length > 0 ? Math.max(...bids.map((o) => o.total)) : 0;

  const maxTotal = Math.max(maxAskTotal, maxBidTotal);

  return (
    <Card className="w-full">
      <CardContent>
        <Table className="text-right">
          <TableHeader>
            <TableRow className=" hover:bg-background">
              <TableHead className=" py-1 text-right text-xs">
                Price ({buyToken?.name})
              </TableHead>
              <TableHead className=" py-1 text-right text-xs">
                Quantity ({sellToken?.name})
              </TableHead>
              <TableHead className=" py-1 text-right text-xs">
                Total ({buyToken?.name})
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {asks.map((order, index) => {
              const gradientPercentage = maxTotal
                ? (order.total / maxTotal) * 100
                : 0;
              return (
                <TableRow key={`ask-${index}`}>
                  <TableCell className="py-1 text-red-600 ">
                    {order.price}
                  </TableCell>
                  <TableCell className="py-1 ">{order.quantity}</TableCell>
                  <TableCell
                    className="relative py-1 "
                    style={{
                      background: `linear-gradient(to left, rgba(161, 6, 6, 0.3) ${gradientPercentage}%, transparent ${gradientPercentage}%)`,
                    }}
                  >
                    {order.total}
                  </TableCell>
                </TableRow>
              );
            })}

            {bids.map((order, index) => {
              const gradientPercentage = maxTotal
                ? (order.total / maxTotal) * 100
                : 0;
              return (
                <TableRow key={`bid-${index}`}>
                  <TableCell className="py-1 text-green-600">
                    {order.price}
                  </TableCell>
                  <TableCell className=" py-1">{order.quantity}</TableCell>
                  <TableCell
                    className="relative py-1"
                    style={{
                      background: `linear-gradient(to left, rgba(4, 109, 4, 0.3) ${gradientPercentage}%, transparent ${gradientPercentage}%)`,
                    }}
                  >
                    {order.total}
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
