import { calculateSwap } from "./swapFunctions";

const MAX_HOP = 5;
const MAX_LIMIT_ORDERS = 10;

function buildGraph(
  poolStore: PoolStoreState,
  limitStore: LimitStoreState,
  currentBlockHeight: number,
) {
  const graph: Record<
    string,
    { token: RouteToken; simulateHop: (amountIn: number) => RouteStep[] }[]
  > = {};

  for (const pool of poolStore.poolList) {
    const t0 = pool.token0;
    const t1 = pool.token1;

    addPoolEdge(graph, t0, t1, pool);
    addPoolEdge(graph, t1, t0, pool);
  }

  for (const order of limitStore.limitOrders) {
    if (order.isActive && Number(order.expiration) > currentBlockHeight) {
      const tokenIn = poolStore.tokenList.find(
        (t) => t.tokenId === order.tokenIn,
      );
      const tokenOut = poolStore.tokenList.find(
        (t) => t.tokenId === order.tokenOut,
      );
      if (!tokenIn || !tokenOut) continue;

      addLimitOrderEdge(
        graph,
        tokenIn,
        tokenOut,
        limitStore,
        currentBlockHeight,
      );
    }
  }

  return graph;
}

function addPoolEdge(
  graph: Record<
    string,
    { token: RouteToken; simulateHop: (amountIn: number) => RouteStep[] }[]
  >,
  from: RouteToken,
  to: RouteToken,
  pool: Pool,
) {
  if (!graph[from.name]) graph[from.name] = [];

  graph[from.name].push({
    token: to,
    simulateHop: (amountIn: number) => {
      const poolBuyTokenReserve =
        pool.token0.name === to.name
          ? Number(pool.token0Amount)
          : Number(pool.token1Amount);
      const poolSellTokenReserve =
        pool.token0.name === from.name
          ? Number(pool.token0Amount)
          : Number(pool.token1Amount);

      const poolFeeTier = Number(pool.fee);

      const { amountOut } = calculateSwap(
        poolBuyTokenReserve,
        poolSellTokenReserve,
        amountIn,
        poolFeeTier,
      );

      return [
        {
          tokenIn: from,
          tokenOut: to,
          orders: [],
          poolSwap: true,
          amountIn,
          amountOut,
        },
      ];
    },
  });
}

function addLimitOrderEdge(
  graph: Record<
    string,
    { token: RouteToken; simulateHop: (amountIn: number) => RouteStep[] }[]
  >,
  from: RouteToken,
  to: RouteToken,
  limitStore: LimitStoreState,
  currentBlockHeight: number,
) {
  if (!graph[from.name]) graph[from.name] = [];

  graph[from.name].push({
    token: to,
    simulateHop: (amountIn: number) => {
      const relevantOrders = limitStore.limitOrders
        .filter((order) => {
          return (
            order.isActive &&
            Number(order.expiration) > currentBlockHeight &&
            order.tokenIn === from.tokenId &&
            order.tokenOut === to.tokenId
          );
        })
        .map((order) => {
          const inAmt = Number(order.tokenInAmount);
          const outAmt = Number(order.tokenOutAmount);
          return {
            orderId: order.orderId,
            tokenInAmount: inAmt,
            tokenOutAmount: outAmt,
            price: outAmt / inAmt,
          };
        })
        .sort((a, b) => b.price - a.price);

      let remaining = amountIn;
      const chosenOrders = [];
      let totalOut = 0;

      for (
        let i = 0;
        i < relevantOrders.length && chosenOrders.length < MAX_LIMIT_ORDERS;
        i++
      ) {
        const ord = relevantOrders[i];
        if (ord.tokenInAmount <= remaining) {
          chosenOrders.push(ord);
          remaining -= ord.tokenInAmount;
          totalOut += ord.tokenOutAmount;
        }
      }

      const steps: RouteStep[] = [
        {
          tokenIn: from,
          tokenOut: to,
          orders: chosenOrders,
          poolSwap: false,
          amountIn,
          amountOut: totalOut,
        },
      ];

      return steps;
    },
  });
}

export function findBestRoute(
  sourceToken: RouteToken,
  targetToken: RouteToken,
  initialAmount: number,
  poolStore: PoolStoreState,
  limitStore: LimitStoreState,
  currentBlockHeight: number,
): CompleteRoute | null {
  console.log("tokenList", poolStore.tokenList);
  console.log("poolList", poolStore.poolList);
  console.log("limitOrders", limitStore.limitOrders);

  const graph = buildGraph(poolStore, limitStore, currentBlockHeight);

  // dp[h][tokenName] = {maxAmount: number, route: CompleteRoute}
  const dp: Record<
    number,
    Record<string, { maxAmount: number; route: CompleteRoute }>
  > = {};

  for (let h = 0; h <= MAX_HOP; h++) {
    dp[h] = {};
  }

  dp[0][sourceToken.name] = {
    maxAmount: initialAmount,
    route: { steps: [], finalAmountOut: initialAmount },
  };

  for (let h = 1; h <= MAX_HOP; h++) {
    for (const tokenName in dp[h - 1]) {
      const state = dp[h - 1][tokenName];
      const currentAmount = state.maxAmount;
      const adj = graph[tokenName] || [];
      for (const edge of adj) {
        const nextToken = edge.token;
        const steps = edge.simulateHop(currentAmount);
        for (const step of steps) {
          const newAmount = step.amountOut;
          const oldBest = dp[h][nextToken.name]?.maxAmount ?? 0;
          if (newAmount > oldBest) {
            dp[h][nextToken.name] = {
              maxAmount: newAmount,
              route: {
                steps: [...state.route.steps, step],
                finalAmountOut: newAmount,
              },
            };
          }
        }
      }
    }
  }

  let bestRoute: CompleteRoute | null = null;
  let bestAmount = 0;
  for (let h = 1; h <= MAX_HOP; h++) {
    const candidate = dp[h][targetToken.name];
    if (candidate && candidate.maxAmount > bestAmount) {
      bestAmount = candidate.maxAmount;
      bestRoute = candidate.route;
    }
  }

  return bestRoute;
}
