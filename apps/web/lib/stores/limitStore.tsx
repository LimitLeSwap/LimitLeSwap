import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
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
    // @ts-expect-error
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
    // @ts-expect-error
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
  // @ts-expect-error
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

export interface ActiveOrderInterface {
  data: {
    limitOrders: [LimitOrder];
  };
}

export const useLimitStore = create<LimitState, [["zustand/immer", never]]>(
  immer((set) => ({
    limitOrders: [],
    setLimitOrders: (newLimitOrders: LimitOrder[]) => {
      set((state) => {
        state.limitOrders = newLimitOrders;
      });
    },
  })),
);

export const useObserveOrders = () => {
  const chain = useChainStore();
  const limitStore = useLimitStore();

  const previousLimitOrdersRef = useRef<LimitOrder[]>(limitStore.limitOrders);

  useEffect(() => {
    // console.log("Observing orders");

    (async () => {
      // Wait for the chain to be processed
      await new Promise((resolve) => setTimeout(resolve, 1000));

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
          query: `query GetActiveOrders {
  limitOrders(where: {expireBlock: {gt: ${chain.block?.height}}, active: {equals: true}}) {
    createdAt
    expireBlock
    orderId
    owner
    tokenInId
    tokenInAmount
    tokenOutAmount
    tokenOutId
  }
}`,
        }),
      });

      const { data } = (await response.json()) as ActiveOrderInterface;

      // data && console.log("data", data);
      // console.log("limit store", limitStore.limitOrders);
      // console.log("ref", previousLimitOrdersRef.current);
      // console.log(
      //   "equal",
      //   isEqual(previousLimitOrdersRef.current, [...data.limitOrders]),
      // );

      if (
        data &&
        data.limitOrders &&
        !isEqual(previousLimitOrdersRef.current, [...data.limitOrders])
      ) {
        limitStore.setLimitOrders([...data.limitOrders]);
        previousLimitOrdersRef.current = [...data.limitOrders];
      }

      // console.log("limit store", limitStore.limitOrders);
    })();
  }, [chain.block?.height]);
};
