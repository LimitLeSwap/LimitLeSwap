// Customized knapsack algorithm to find the best route for a swap
// based on the available pools and limit orders
// To find the best route, maybe we can use a heuristic approach

import { calculateSwap } from "./swapFunctions";

const MAX_HOP = 5;
const MAX_LIMIT_ORDERS = 10;

const SCALE_FACTOR = 1e3;
const EPSILON = 1.001;

function buildGraph(poolStore: PoolStoreState, limitStore: LimitStoreState) {
  const graph: Record<
    string,
    { token: RouteToken; simulateHop: (scaledIn: number) => RouteStep[] }[]
  > = {};

  for (const pool of poolStore.poolList) {
    const t0 = pool.token0;
    const t1 = pool.token1;
    addPoolEdge(graph, t0, t1, pool);
    addPoolEdge(graph, t1, t0, pool);
  }

  for (const order of limitStore.limitOrders) {
    const tokenIn = poolStore.tokenList.find(
      (t) => t.tokenId === order.tokenInId,
    );
    const tokenOut = poolStore.tokenList.find(
      (t) => t.tokenId === order.tokenOutId,
    );
    if (!tokenIn || !tokenOut) continue;

    addLimitOrderEdge(graph, tokenIn, tokenOut, limitStore);
  }

  return graph;
}

function addPoolEdge(
  graph: Record<
    string,
    { token: RouteToken; simulateHop: (scaledIn: number) => RouteStep[] }[]
  >,
  tokenIn: RouteToken,
  tokenOut: RouteToken,
  pool: Pool,
) {
  if (!graph[tokenIn.name]) graph[tokenIn.name] = [];

  graph[tokenIn.name].push({
    token: tokenOut,
    simulateHop: (scaledAmountIn: number) => {
      const realAmountIn = scaledAmountIn * SCALE_FACTOR;

      const poolBuyTokenReserve =
        pool.token0.name === tokenOut.name
          ? Number(pool.token0Amount)
          : Number(pool.token1Amount);

      const poolSellTokenReserve =
        pool.token0.name === tokenIn.name
          ? Number(pool.token0Amount)
          : Number(pool.token1Amount);

      const poolFeeTier = Number(pool.fee);

      const { amountOut } = calculateSwap(
        poolBuyTokenReserve,
        poolSellTokenReserve,
        realAmountIn,
        poolFeeTier,
      );

      const scaledAmountOut = Math.floor(amountOut / SCALE_FACTOR);

      return [
        {
          tokenIn,
          tokenOut,
          orders: [],
          poolSwap: true,
          amountIn: scaledAmountIn,
          amountOut: scaledAmountOut,
        },
      ];
    },
  });
}

function addLimitOrderEdge(
  graph: Record<
    string,
    { token: RouteToken; simulateHop: (scaledIn: number) => RouteStep[] }[]
  >,
  tokenIn: RouteToken,
  tokenOut: RouteToken,
  limitStore: LimitStoreState,
) {
  if (!graph[tokenIn.name]) graph[tokenIn.name] = [];

  graph[tokenIn.name].push({
    token: tokenOut,
    simulateHop: (scaledAmountIn: number) => {
      const relevantOrders = limitStore.limitOrders
        .filter(
          (order) =>
            order.tokenInId === tokenIn.tokenId &&
            order.tokenOutId === tokenOut.tokenId,
        )
        .map((order) => {
          const inAmt = Math.floor(Number(order.tokenInAmount) / SCALE_FACTOR);
          const outAmt = Math.floor(
            Number(order.tokenOutAmount) / SCALE_FACTOR,
          );
          return {
            orderId: order.orderId,
            tokenInAmount: inAmt,
            tokenOutAmount: outAmt,
          };
        });

      const n = relevantOrders.length;
      const dp: number[][][] = Array.from({ length: n + 1 }, () =>
        Array.from({ length: scaledAmountIn + 1 }, () =>
          Array.from({ length: MAX_LIMIT_ORDERS + 1 }, () => 0),
        ),
      );

      for (let i = 1; i <= n; i++) {
        const { tokenInAmount, tokenOutAmount } = relevantOrders[i - 1];
        for (let j = 0; j <= scaledAmountIn; j++) {
          for (let k = 0; k <= MAX_LIMIT_ORDERS; k++) {
            dp[i][j][k] = dp[i - 1][j][k];
            if (tokenInAmount <= j && k > 0) {
              dp[i][j][k] = Math.max(
                dp[i][j][k],
                dp[i - 1][j - tokenInAmount][k - 1] + tokenOutAmount,
              );
            }
          }
        }
      }

      let bestValue = 0;
      let bestJ = 0;
      let bestK = 0;
      for (let j = 0; j <= scaledAmountIn; j++) {
        for (let k = 0; k <= MAX_LIMIT_ORDERS; k++) {
          if (dp[n][j][k] > bestValue) {
            bestValue = dp[n][j][k];
            bestJ = j;
            bestK = k;
          }
        }
      }

      const orders = [];
      let i = n;
      let j = bestJ;
      let k = bestK;
      while (i > 0 && k > 0) {
        if (dp[i][j][k] !== dp[i - 1][j][k]) {
          const ord = relevantOrders[i - 1];
          orders.push(ord);
          j -= ord.tokenInAmount;
          k -= 1;
        }
        i--;
      }
      orders.reverse();

      const scaledAmountOut = bestValue;

      return [
        {
          tokenIn,
          tokenOut,
          orders,
          poolSwap: false,
          amountIn: scaledAmountIn,
          amountOut: scaledAmountOut,
        },
      ];
    },
  });
}

export function findBestRoute(
  sourceToken: RouteToken,
  targetToken: RouteToken,
  rawInitialAmount: number,
  poolStore: PoolStoreState,
  limitStore: LimitStoreState,
): CompleteRoute | null {
  console.log("tokenList", poolStore.tokenList);
  console.log("poolList", poolStore.poolList);
  console.log("limitOrders", limitStore.limitOrders);

  const scaledInitialAmount = Math.floor(rawInitialAmount / SCALE_FACTOR);
  if (scaledInitialAmount <= 0) {
    return null;
  }

  const graph = buildGraph(poolStore, limitStore);

  const tokenIdToIndex: Record<string, number> = {};
  poolStore.tokenList.forEach((t, i) => {
    tokenIdToIndex[t.tokenId] = i;
  });
  const nTokens = poolStore.tokenList.length;

  const dp = Array.from({ length: MAX_HOP + 1 }, () =>
    new Array<number>(nTokens).fill(0),
  );

  interface ParentInfo {
    prevHop: number;
    prevTokenId: string;
    step: RouteStep;
  }
  const parent = Array.from({ length: MAX_HOP + 1 }, () =>
    new Array<ParentInfo | undefined>(nTokens).fill(undefined),
  );

  const sourceIdx = tokenIdToIndex[sourceToken.tokenId];
  dp[0][sourceIdx] = scaledInitialAmount;

  for (let h = 0; h < MAX_HOP; h++) {
    for (let i = 0; i < nTokens; i++) {
      const curAmount = dp[h][i];
      if (curAmount <= 0) continue;

      if (curAmount > dp[h + 1][i]) {
        dp[h + 1][i] = curAmount;
        parent[h + 1][i] = parent[h][i];
      }

      const curToken = poolStore.tokenList[i];
      const edges = graph[curToken.name] || [];
      for (const edge of edges) {
        const nextTokenIdx = tokenIdToIndex[edge.token.tokenId];
        const steps = edge.simulateHop(curAmount);

        for (const st of steps) {
          if (st.amountOut <= dp[h + 1][nextTokenIdx] * EPSILON) {
            continue;
          }

          if (st.amountOut > dp[h + 1][nextTokenIdx]) {
            dp[h + 1][nextTokenIdx] = st.amountOut;
            parent[h + 1][nextTokenIdx] = {
              prevHop: h,
              prevTokenId: curToken.tokenId,
              step: st,
            };
          }
        }
      }
    }
  }

  const targetIdx = tokenIdToIndex[targetToken.tokenId];
  let bestHop = 0;
  let bestScaledOut = 0;
  for (let h = 0; h <= MAX_HOP; h++) {
    if (dp[h][targetIdx] > bestScaledOut) {
      bestScaledOut = dp[h][targetIdx];
      bestHop = h;
    }
  }
  if (bestScaledOut <= 0) {
    return null;
  }

  const routeSteps: RouteStep[] = [];
  let curHop = bestHop;
  let curIdx = targetIdx;

  while (curHop > 0) {
    const p = parent[curHop][curIdx];
    if (!p) {
      curHop--;
      continue;
    }
    routeSteps.push(p.step);

    curIdx = tokenIdToIndex[p.prevTokenId];
    curHop = p.prevHop;
  }
  routeSteps.reverse();

  const finalAmountOut = bestScaledOut * SCALE_FACTOR;

  return {
    steps: routeSteps,
    finalAmountOut,
  };
}
