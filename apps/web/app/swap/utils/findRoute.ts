import { calculateSwap } from "./swapFunctions";

const MAX_HOP = 5;
const MAX_LIMIT_ORDERS = 10;

function buildGraph(poolStore: PoolStoreState, limitStore: LimitStoreState) {
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
    { token: RouteToken; simulateHop: (amountIn: number) => RouteStep[] }[]
  >,
  tokenIn: RouteToken,
  tokenOut: RouteToken,
  pool: Pool,
) {
  if (!graph[tokenIn.name]) graph[tokenIn.name] = [];

  graph[tokenIn.name].push({
    token: tokenOut,
    simulateHop: (amountIn: number) => {
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
        amountIn,
        poolFeeTier,
      );

      return [
        {
          tokenIn,
          tokenOut,
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
  tokenIn: RouteToken,
  tokenOut: RouteToken,
  limitStore: LimitStoreState,
) {
  if (!graph[tokenIn.name]) graph[tokenIn.name] = [];

  graph[tokenIn.name].push({
    token: tokenOut,
    simulateHop: (amountIn: number) => {
      const relevantOrders = limitStore.limitOrders
        .filter((order) => {
          return (
            order.tokenInId === tokenIn.tokenId &&
            order.tokenOutId === tokenOut.tokenId
          );
        })
        .map((order) => {
          const inAmt = Number(order.tokenInAmount);
          const outAmt = Number(order.tokenOutAmount);
          return {
            orderId: order.orderId,
            tokenInAmount: inAmt,
            tokenOutAmount: outAmt,
          };
        });

      const n = relevantOrders.length;
      const dp: number[][][] = Array.from({ length: n + 1 }, () =>
        Array.from({ length: amountIn + 1 }, () =>
          Array.from({ length: MAX_LIMIT_ORDERS + 1 }, () => 0),
        ),
      );

      for (let i = 1; i <= n; i++) {
        const { tokenInAmount, tokenOutAmount } = relevantOrders[i - 1];
        for (let j = 0; j <= amountIn; j++) {
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
      for (let j = 0; j <= amountIn; j++) {
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

      const amountOut = orders.reduce((acc, o) => acc + o.tokenOutAmount, 0);

      const steps: RouteStep[] = [
        {
          tokenIn,
          tokenOut,
          orders,
          poolSwap: false,
          amountIn,
          amountOut,
        },
      ];

      return steps;
    },
  });
}

interface State {
  currentToken: RouteToken;
  currentAmount: number;
  steps: RouteStep[];
  hopCount: number;
}

export function findBestRoute(
  sourceToken: RouteToken,
  targetToken: RouteToken,
  initialAmount: number,
  poolStore: PoolStoreState,
  limitStore: LimitStoreState,
): CompleteRoute | null {
  console.log("tokenList", poolStore.tokenList);
  console.log("poolList", poolStore.poolList);
  console.log("limitOrders", limitStore.limitOrders);

  const graph = buildGraph(poolStore, limitStore);

  let bestRoute: CompleteRoute | null = null;

  const visited: Record<string, number[]> = {};

  for (const token of poolStore.tokenList) {
    visited[token.tokenId] = Array(MAX_HOP + 1).fill(0);
  }

  visited[sourceToken.tokenId][0] = initialAmount;

  const queue: State[] = [
    {
      currentToken: sourceToken,
      currentAmount: initialAmount,
      steps: [],
      hopCount: 0,
    },
  ];

  while (queue.length > 0) {
    const { currentToken, currentAmount, steps, hopCount } = queue.shift()!;

    if (currentToken.tokenId === targetToken.tokenId) {
      if (!bestRoute || currentAmount > bestRoute.finalAmountOut) {
        bestRoute = {
          steps,
          finalAmountOut: currentAmount,
        };
      }
    }

    if (hopCount === MAX_HOP) {
      continue;
    }

    const edges = graph[currentToken.name] || [];
    for (const edge of edges) {
      const simulatedSteps = edge.simulateHop(currentAmount);
      for (const step of simulatedSteps) {
        if (step.amountOut <= 0) continue;

        const nextToken = step.tokenOut;
        const nextAmount = step.amountOut;
        const nextHopCount = hopCount + 1;

        if (nextAmount <= visited[nextToken.tokenId][nextHopCount]) {
          continue;
        }

        visited[nextToken.tokenId][nextHopCount] = nextAmount;

        queue.push({
          currentToken: nextToken,
          currentAmount: nextAmount,
          steps: [...steps, step],
          hopCount: nextHopCount,
        });
      }
    }
  }

  return bestRoute;
}
