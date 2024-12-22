import React, { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useLimitStore } from "@/lib/stores/limitStore";
import { useWalletStore } from "@/lib/stores/wallet";
import { usePoolStore } from "@/lib/stores/poolStore";
import { useChainStore } from "@/lib/stores/chain";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClientStore } from "@/lib/stores/client";
import { Field, PublicKey } from "o1js";
import { DECIMALS } from "@/lib/constants";
import { PendingTransaction } from "@proto-kit/sequencer";
import { useToast } from "@/components/ui/use-toast";
import { findTokenByTokenId } from "@/lib/common";

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
      <CardContent>
        <Table>
          <TableBody>
            <TableRow className=" w-100 flex flex-row items-center justify-between px-1 py-2">
              <TableCell className="flex p-0">
                <div className=" font-sm text-red-600">Sell</div>
              </TableCell>
              <TableCell className="flex p-0 ">
                <div className=" text-sm  text-green-600">Buy</div>
              </TableCell>
              <TableCell className="flex p-0 ">
                <div className=" text-sm">Valid Until</div>
              </TableCell>
              <TableCell className="flex p-0 ">
                <div className=" text-sm">Action</div>
              </TableCell>
            </TableRow>
            <ScrollArea className=" h-36">
              {limitOrders &&
                limitOrders.length > 0 &&
                limitOrders.map((limitOrder) => {
                  const tokenIn = findTokenByTokenId(
                    limitOrder.tokenIn,
                    poolStore.tokenList ?? [],
                  );

                  const tokenOut = findTokenByTokenId(
                    limitOrder.tokenOut,
                    poolStore.tokenList ?? [],
                  );

                  return (
                    <TableRow
                      className=" flex flex-row items-center justify-between px-1 py-4"
                      key={limitOrder.orderId}
                    >
                      <TableCell className="flex p-0 text-xs">
                        {Number(limitOrder.tokenInAmount) / Number(DECIMALS)}{" "}
                        {tokenIn?.name}{" "}
                      </TableCell>

                      <TableCell className="flex p-0 text-xs">
                        {Number(limitOrder.tokenOutAmount) / Number(DECIMALS)}{" "}
                        {tokenOut?.name}
                      </TableCell>

                      <TableCell className="flex p-0 text-xs">
                        {limitOrder.expiration}
                      </TableCell>
                      <TableCell className="flex p-0 text-xs">
                        <Button
                          variant={"hover"}
                          className=" flex items-center justify-center"
                          onClick={() => {
                            cancelOrder(limitOrder);
                          }}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {limitOrders.length === 0 && (
                <TableRow className=" flex flex-row items-center justify-between px-1 py-4">
                  No orders
                </TableRow>
              )}
            </ScrollArea>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
