import React, { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useLimitStore } from "@/lib/stores/limitStore";
import { useWalletStore } from "@/lib/stores/wallet";
import { usePoolStore } from "@/lib/stores/poolStore";
import { useChainStore } from "@/lib/stores/chain";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClientStore } from "@/lib/stores/client";
import { Field, PublicKey } from "o1js";
import { DECIMALS } from "@/lib/constants";
import { PendingTransaction } from "@proto-kit/sequencer";
import { useToast } from "@/components/ui/use-toast";
import { findPool } from "@/lib/common";

export default function MyOrders() {
  const walletStore = useWalletStore();
  const limitStore = useLimitStore();
  const poolStore = usePoolStore();
  const chainStore = useChainStore();
  const client = useClientStore();

  const { toast } = useToast();

  const cancelOrder = async (order: LimitOrder) => {
    if (client.client && walletStore.wallet) {
      const orderbook = client.client.runtime.resolve("OrderBook");

      const tx = await client.client.transaction(
        PublicKey.fromBase58(walletStore.wallet),
        async () => {
          await orderbook.cancelLimitOrder(Field.from(order.orderId));
        },
      );
      await tx.sign();
      await tx.send();

      if (tx.transaction instanceof PendingTransaction)
        walletStore.addPendingTransaction(tx.transaction);
      else {
        toast({
          title: "Transaction failed",
          description: "Please try again",
        });
      }
    }
  };

  const [limitOrders, setLimitOrders] = useState<LimitOrder[]>([]);

  useEffect(() => {
    if (!client.client || !walletStore.wallet) return;

    console.log("limitStore.limitOrders", limitStore.limitOrders);

    const orderList = limitStore.limitOrders.filter(
      (order) =>
        order.owner.toBase58() === walletStore.wallet &&
        order.isActive &&
        Number(order.expiration) > Number(chainStore.block?.height ?? 0),
    );

    setLimitOrders(orderList);

    return () => {
      setLimitOrders([]);
    };
  }, [
    limitStore.limitOrders,
    walletStore.wallet,
    chainStore.block,
    client.client,
  ]);

  return (
    <Card className="my-8 flex w-full flex-col rounded-2xl shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">Active Orders</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className=" h-40">
          <Table>
            <TableBody>
              {limitOrders &&
                limitOrders.length > 0 &&
                limitOrders.map((limitOrder) => {
                  const [tokenIn, tokenOut] = findPool(
                    limitOrder.tokenIn,
                    limitOrder.tokenOut,
                    poolStore,
                  );

                  return (
                    <TableRow
                      className=" flex flex-row items-center justify-between"
                      key={limitOrder.orderId}
                    >
                      <TableCell className="flex flex-col px-1 py-4">
                        <div>
                          <span className=" font-medium text-red-600">
                            Sell
                          </span>{" "}
                          {Number(limitOrder.tokenInAmount) / Number(DECIMALS)}{" "}
                          {tokenIn?.name}{" "}
                        </div>
                        <div>
                          <span className=" font-medium text-green-600">
                            For
                          </span>{" "}
                          {Number(limitOrder.tokenOutAmount) / Number(DECIMALS)}{" "}
                          {tokenOut?.name}
                        </div>
                        <div className=" text-sm">
                          <span className=" text-sm font-normal">
                            {" "}
                            Valid until:{" "}
                          </span>
                          {limitOrder.expiration}
                        </div>
                      </TableCell>

                      <TableCell className="flex p-0">
                        <Button
                          variant={"hover"}
                          className=" flex items-center justify-center text-sm"
                          onClick={() => {
                            cancelOrder(limitOrder);
                          }}
                        >
                          Cancel <X className=" h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
