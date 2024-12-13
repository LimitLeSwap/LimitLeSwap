import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { useClientStore } from "./client";
import { useWalletStore } from "./wallet";
import { useChainStore } from "./chain";
import { useEffect, useRef } from "react";
import { Field, Provable, PublicKey, Struct } from "o1js";
import isEqual from "lodash.isequal";

export const MAX_ORDER_SIZE = 10;

export class OrderBundle extends Struct({
  bundle: Provable.Array(Field, MAX_ORDER_SIZE),
}) {
  public static empty(): OrderBundle {
    const bundle = Array<Field>(10).fill(Field.from(0));
    return new OrderBundle({ bundle });
  }
}

export interface LimitState {
  limitOrders: LimitOrder[];
  setLimitOrders: (limitOrders: LimitOrder[]) => void;
}

export const useLimitStore = create<LimitState, [["zustand/immer", never]]>(
  immer((set) => ({
    limitOrders: [],
    setLimitOrders: (_limitOrders: LimitOrder[]) =>
      set({ limitOrders: _limitOrders }),
  })),
);

export const useObserveOrders = () => {
  const client = useClientStore();
  const chain = useChainStore();
  const limitStore = useLimitStore();
  const wallet = useWalletStore();

  const previousLimitOrdersRef = useRef<LimitOrder[]>([]);

  useEffect(() => {
    if (!client || !client.client || !wallet.wallet) return;

    (async () => {
      let orderCount =
        await client.client!.query.runtime.OrderBook.orderNonce.get();

      if (
        !orderCount ||
        !orderCount.value ||
        !orderCount.value[1] ||
        !orderCount.value[1][1]
      ) {
        return;
      }
      orderCount = orderCount.value[1][1].toString();

      const limitOrders: LimitOrder[] = [];

      for (let i = 0; i < Number(orderCount); i++) {
        const order = await client.client!.query.runtime.OrderBook.orders.get(
          Field.from(i),
        );

        if (!order) {
          continue;
        }

        // limitOrders.push({
        //   orderId: i,
        //   expiration: Field.fromJSON(order.expiration).toString(),
        //   isActive: Bool.fromJSON(order.isActive).toBoolean(),
        //   tokenIn: Field.fromJSON(order.tokenIn).toString(),
        //   tokenInAmount: Field.fromJSON(order.tokenInAmount).toString(),
        //   tokenOut: Field.fromJSON(order.tokenOut).toString(),
        //   tokenOutAmount: Field.fromJSON(order.tokenOutAmount).toString(),
        //   owner: PublicKey.fromJSON(order.owner.toJSON()),
        // });

        limitOrders.push({
          orderId: i,
          expiration: order.expiration.toString(),
          isActive: order.isActive.toBoolean(),
          tokenIn: order.tokenIn.toString(),
          tokenInAmount: order.tokenInAmount.toString(),
          tokenOut: order.tokenOut.toString(),
          tokenOutAmount: order.tokenOutAmount.toString(),
          owner: order.owner,
        });

        if (!previousLimitOrdersRef.current) {
          limitStore.setLimitOrders(limitOrders);
          previousLimitOrdersRef.current = limitOrders;
        } else if (
          !previousLimitOrdersRef.current ||
          !previousLimitOrdersRef.current.length ||
          !limitOrders.length ||
          !previousLimitOrdersRef.current.every((order, index) =>
            isEqual(order, limitOrders[index]),
          )
        ) {
          limitStore.setLimitOrders(limitOrders);
          previousLimitOrdersRef.current = limitOrders;
        }
      }
    })();
  }, [client.client, chain.block?.height, wallet.wallet]);
};
