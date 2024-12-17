import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { useClientStore } from "./client";
import { useWalletStore } from "./wallet";
import { useChainStore } from "./chain";
import { useEffect, useRef } from "react";
import { Field, Provable, Struct } from "o1js";
import isEqual from "lodash.isequal";
import { Balance, TokenId } from "@proto-kit/library";

export const MAX_ORDER_SIZE = 10;
export const MAX_ROUTE_SIZE = 5;

export class OrderBundle extends Struct({
  bundle: Provable.Array(Field, MAX_ORDER_SIZE),
}) {
  public static empty(): OrderBundle {
    const bundle = Array<Field>(10).fill(Field.from(0));
    return new OrderBundle({ bundle });
  }
}

export class Step extends Struct({
  tokenIn: TokenId,
  tokenOut: TokenId,
  amountIn: Balance,
  amountOut: Balance,
  limitOrders: OrderBundle,
}) {
  public static empty(): Step {
    return new Step({
      tokenIn: TokenId.from(0),
      tokenOut: TokenId.from(0),
      amountIn: Balance.from(0),
      amountOut: Balance.from(0),
      limitOrders: OrderBundle.empty(),
    });
  }
  public static from(
    tokenIn: TokenId,
    tokenOut: TokenId,
    amountIn: Balance,
    amountOut: Balance,
    limitOrders: OrderBundle,
  ) {
    return new Step({
      tokenIn,
      tokenOut,
      amountIn,
      amountOut,
      limitOrders,
    });
  }
}

export class Route extends Struct({
  path: Provable.Array(Step, MAX_ROUTE_SIZE),
}) {
  public static empty(): Route {
    const path = Array<Step>(10).fill(Step.empty());
    return new Route({ path });
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
