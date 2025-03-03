import { calculateSwap } from "./swapFunctions";

const MAX_HOP = 5;
const MAX_LIMIT_ORDERS = 10;
const SCALE_FACTOR = 1e5;
const EPSILON = 1.0001;

// A bitmask to track used pools (so each pool is used at most once)
type PoolIdIndex = Record<string, number>;

interface MixedRouteStep extends RouteStep {
  limitInScaled: number;
  poolInScaled: number;
  poolId?: string;
}

let isDebug = true;
function log(...args: any[]) {
  if (isDebug) {
    console.log(...args);
  }
}

interface State {
  token: RouteToken;
  scaledAmount: number;
  usedPools: number;
  hopCount: number;
  steps: MixedRouteStep[];
}

function buildGraph(
  poolStore: PoolStoreState,
  limitStore: LimitStoreState,
  poolIdIndex: PoolIdIndex,
) {
  log("[buildGraph] Start");
  const graph: Record<
    string,
    {
      tokenOut: RouteToken;
      pool?: Pool;
      orders: {
        orderId: string;
        tokenInAmount: number;
        tokenOutAmount: number;
      }[];
    }[]
  > = {};

  for (const pool of poolStore.poolList) {
    const t0 = pool.token0;
    const t1 = pool.token1;
    log(`[buildGraph] Pool ${pool.poolId}: ${t0.name} <-> ${t1.name}`);

    if (!graph[t0.name]) {
      graph[t0.name] = [];
    }
    graph[t0.name].push({
      tokenOut: t1,
      pool,
      orders: [],
    });

    if (!graph[t1.name]) {
      graph[t1.name] = [];
    }
    graph[t1.name].push({
      tokenOut: t0,
      pool,
      orders: [],
    });
  }

  for (const order of limitStore.limitOrders) {
    const tokenIn = poolStore.tokenList.find(
      (t) => t.tokenId === order.tokenOutId,
    );
    const tokenOut = poolStore.tokenList.find(
      (t) => t.tokenId === order.tokenInId,
    );
    if (!tokenIn || !tokenOut) {
      console.warn(
        `[buildGraph] Skipping order ${order.orderId} (invalid tokens)`,
      );
      continue;
    }

    const inAmt = Math.floor(Number(order.tokenOutAmount) / SCALE_FACTOR);
    const outAmt = Math.floor(Number(order.tokenInAmount) / SCALE_FACTOR);

    if (!graph[tokenIn.name]) {
      graph[tokenIn.name] = [];
    }

    let edge = graph[tokenIn.name].find(
      (e) => e.tokenOut.name === tokenOut.name,
    );
    if (!edge) {
      edge = { tokenOut, pool: undefined, orders: [] };
      graph[tokenIn.name].push(edge);
    }
    edge.orders.push({
      orderId: order.orderId,
      tokenInAmount: inAmt,
      tokenOutAmount: outAmt,
    });
    log(
      `[buildGraph] Order ${order.orderId}, ${tokenIn.name} -> ${tokenOut.name}, scaledIn=${inAmt}, scaledOut=${outAmt}`,
    );
  }

  log("[buildGraph] Complete");
  return graph;
}

function simulateMixedHop(
  tokenIn: RouteToken,
  edge: {
    tokenOut: RouteToken;
    pool?: Pool;
    orders: {
      orderId: string;
      tokenInAmount: number;
      tokenOutAmount: number;
    }[];
  },
  scaledAmountIn: number,
  usedPools: number,
  poolIdIndex: PoolIdIndex,
): MixedRouteStep {
  log(
    `[simulateMixedHop] ${tokenIn.name} => ${edge.tokenOut.name}, scaledIn=${scaledAmountIn}`,
  );

  let poolAvailable = false;
  let poolId: string | undefined = undefined;
  if (edge.pool) {
    const idx = poolIdIndex[edge.pool.poolId] ?? -1;
    if (idx >= 0) {
      const alreadyUsed = ((usedPools >> idx) & 1) === 1;
      poolAvailable = !alreadyUsed;
      poolId = edge.pool.poolId;
    }
  }

  let bestOut = 0;
  let bestDist = 0;
  let bestOrders: typeof edge.orders = [];

  function knapsackLimitOrders(orders: typeof edge.orders, capacity: number) {
    if (capacity <= 0 || orders.length === 0) {
      return { bestVal: 0, chosen: [] as typeof edge.orders };
    }
    const n = orders.length;
    const dp: number[][][] = Array.from({ length: n + 1 }, () =>
      Array.from({ length: capacity + 1 }, () =>
        Array(MAX_LIMIT_ORDERS + 1).fill(0),
      ),
    );

    for (let i = 1; i <= n; i++) {
      const { tokenInAmount, tokenOutAmount } = orders[i - 1];
      for (let c = 0; c <= capacity; c++) {
        for (let k = 0; k <= MAX_LIMIT_ORDERS; k++) {
          dp[i][c][k] = dp[i - 1][c][k];
          if (tokenInAmount <= c && k > 0) {
            const alt = dp[i - 1][c - tokenInAmount][k - 1] + tokenOutAmount;
            if (alt > dp[i][c][k]) {
              dp[i][c][k] = alt;
            }
          }
        }
      }
    }

    let bestVal = 0;
    let bestC = 0;
    let bestK = 0;
    for (let c = 0; c <= capacity; c++) {
      for (let k = 0; k <= MAX_LIMIT_ORDERS; k++) {
        if (dp[n][c][k] > bestVal) {
          bestVal = dp[n][c][k];
          bestC = c;
          bestK = k;
        }
      }
    }

    const chosen: typeof orders = [];
    let i = n,
      c = bestC,
      k = bestK;
    while (i > 0 && k > 0) {
      if (dp[i][c][k] !== dp[i - 1][c][k]) {
        const ord = orders[i - 1];
        chosen.push(ord);
        c -= ord.tokenInAmount;
        k--;
      }
      i--;
    }
    chosen.reverse();
    return { bestVal, chosen };
  }

  for (let dist = 0; dist <= scaledAmountIn; dist++) {
    const limitIn = dist;
    const poolIn = scaledAmountIn - dist;

    const { bestVal: limitOut, chosen } = knapsackLimitOrders(
      edge.orders,
      limitIn,
    );

    let poolOut = 0;
    if (poolAvailable && poolIn > 0 && edge.pool) {
      const realIn = poolIn * SCALE_FACTOR;

      const poolBuyReserve =
        edge.pool.token0.tokenId === edge.tokenOut.tokenId
          ? Number(edge.pool.token0Amount)
          : Number(edge.pool.token1Amount);
      const poolSellReserve =
        edge.pool.token0.tokenId === edge.tokenOut.tokenId
          ? Number(edge.pool.token1Amount)
          : Number(edge.pool.token0Amount);
      const feeTier = Number(edge.pool.fee);

      const { amountOut } = calculateSwap(
        poolBuyReserve,
        poolSellReserve,
        realIn,
        feeTier,
      );
      poolOut = Math.floor(amountOut / SCALE_FACTOR);
    }

    const totalOut = limitOut + poolOut;
    if (totalOut > bestOut) {
      bestOut = totalOut;
      bestDist = dist;
      bestOrders = chosen;
    }
  }

  log(
    `  => bestDist=${bestDist}, totalOut=${bestOut}, poolIn=${scaledAmountIn - bestDist}, #orders=${bestOrders.length}`,
  );

  const step: MixedRouteStep = {
    tokenIn,
    tokenOut: edge.tokenOut,
    orders: bestOrders,
    poolSwap: false,
    amountIn: scaledAmountIn,
    amountOut: bestOut,
    limitInScaled: bestDist,
    poolInScaled: scaledAmountIn - bestDist,
  };
  if (poolAvailable && bestDist < scaledAmountIn && edge.pool) {
    step.poolSwap = true;
    step.poolId = poolId;
  }
  return step;
}

function runBFS(
  sourceToken: RouteToken,
  targetToken: RouteToken,
  scaledInitialAmount: number,
  poolStore: PoolStoreState,
  limitStore: LimitStoreState,
): { steps: MixedRouteStep[]; finalAmountOut: number } | null {
  log("[runBFS] Start BFS with scaledInitialAmount:", scaledInitialAmount);

  const poolIdIndex: PoolIdIndex = {};
  poolStore.poolList.forEach((p, idx) => {
    poolIdIndex[p.poolId] = idx;
  });

  const graph = buildGraph(poolStore, limitStore, poolIdIndex);

  const visited: Record<string, Record<number, number[]>> = {};
  poolStore.tokenList.forEach((t) => {
    visited[t.tokenId] = {};
  });

  const queue: State[] = [
    {
      token: sourceToken,
      scaledAmount: scaledInitialAmount,
      usedPools: 0,
      hopCount: 0,
      steps: [],
    },
  ];

  if (!visited[sourceToken.tokenId][0]) {
    visited[sourceToken.tokenId][0] = Array(MAX_HOP + 1).fill(0);
  }
  visited[sourceToken.tokenId][0][0] = scaledInitialAmount;

  let bestRoute: { steps: MixedRouteStep[]; finalAmountOut: number } | null =
    null;

  while (queue.length > 0) {
    const { token, scaledAmount, usedPools, hopCount, steps } = queue.shift()!;
    log(
      `[runBFS] Pop => token=${token.name}, scaledAmt=${scaledAmount}, usedPools=${usedPools.toString(
        2,
      )}, hop=${hopCount}`,
    );

    if (token.tokenId === targetToken.tokenId) {
      const realAmt = scaledAmount * SCALE_FACTOR;
      log(`   Reached target with realAmt=${realAmt}`);
      if (!bestRoute || realAmt > bestRoute.finalAmountOut) {
        bestRoute = {
          steps,
          finalAmountOut: realAmt,
        };
        log("   => Updated bestRoute");
      }
    }

    if (hopCount === MAX_HOP) {
      continue;
    }

    const edges = graph[token.name] || [];
    for (const edge of edges) {
      log(`  - Edge from ${token.name} to ${edge.tokenOut.name}`);
      log(edge);
      const step = simulateMixedHop(
        token,
        edge,
        scaledAmount,
        usedPools,
        poolIdIndex,
      );
      if (step.amountOut <= 0) {
        continue;
      }
      const nextUsedPools =
        step.poolSwap && step.poolId
          ? usedPools | (1 << poolIdIndex[step.poolId])
          : usedPools;
      const nextHop = hopCount + 1;
      const nextToken = step.tokenOut;
      const nextAmount = step.amountOut;

      if (!visited[nextToken.tokenId][nextUsedPools]) {
        visited[nextToken.tokenId][nextUsedPools] = Array(MAX_HOP + 1).fill(0);
      }
      const oldAmt = visited[nextToken.tokenId][nextUsedPools][nextHop] || 0;
      if (nextAmount > oldAmt * EPSILON) {
        visited[nextToken.tokenId][nextUsedPools][nextHop] = nextAmount;
        queue.push({
          token: nextToken,
          scaledAmount: nextAmount,
          usedPools: nextUsedPools,
          hopCount: nextHop,
          steps: [...steps, step],
        });
      }
    }
  }

  return bestRoute;
}

function finalizeRoute(
  rawInitialAmount: number,
  routeSteps: MixedRouteStep[],
  poolStore: PoolStoreState,
  limitStore: LimitStoreState,
): CompleteRoute {
  log("[finalizeRoute] Start. rawInitialAmount=", rawInitialAmount);

  let remainingAmount = rawInitialAmount;
  const finalSteps: RouteStep[] = [];

  for (let i = 0; i < routeSteps.length; i++) {
    const step = routeSteps[i];

    let realLimitIn = 0;
    let realLimitOut = 0;
    for (let j = 0; j < step.orders.length; j++) {
      const exactOrder = limitStore.limitOrders.find(
        (o) => o.orderId === step.orders[j].orderId,
      );
      if (!exactOrder) {
        console.warn(`[finalizeRoute] Missing order ${step.orders[j].orderId}`);
        continue;
      }

      step.orders[j].tokenInAmount = Number(exactOrder.tokenOutAmount);
      step.orders[j].tokenOutAmount = Number(exactOrder.tokenInAmount);

      realLimitIn += Number(exactOrder.tokenOutAmount);
      realLimitOut += Number(exactOrder.tokenInAmount);
    }

    remainingAmount -= realLimitIn;
    log(
      `[finalizeRoute] Step ${i}: ${step.tokenIn.name} -> ${step.tokenOut.name}, limitIn=${realLimitIn}, limitOut=${realLimitOut}`,
    );

    let realPoolIn = 0;
    let realPoolOut = 0;
    if (step.poolSwap && step.poolId) {
      const pool = poolStore.poolList.find((p) => p.poolId === step.poolId);
      if (!pool) {
        console.warn(`[finalizeRoute] Missing pool ${step.poolId}`);
      } else {
        const poolBuyReserve =
          pool.token0.tokenId === step.tokenOut.tokenId
            ? Number(pool.token0Amount)
            : Number(pool.token1Amount);
        const poolSellReserve =
          pool.token0.tokenId === step.tokenOut.tokenId
            ? Number(pool.token1Amount)
            : Number(pool.token0Amount);
        const feeTier = Number(pool.fee);

        const { amountOut } = calculateSwap(
          poolBuyReserve,
          poolSellReserve,
          remainingAmount,
          feeTier,
        );

        realPoolIn = remainingAmount;
        realPoolOut = Math.floor(amountOut);
      }
    }

    log(
      `[finalizeRoute] Step ${i}: ${step.tokenIn.name} -> ${step.tokenOut.name}, poolIn=${remainingAmount}, poolOut=${realPoolOut}`,
    );

    const finalStep: RouteStep = {
      tokenIn: step.tokenIn,
      tokenOut: step.tokenOut,
      orders: step.orders,
      poolSwap: step.poolSwap,
      amountIn: realLimitIn + realPoolIn,
      amountOut: realLimitOut + realPoolOut,
    };
    finalSteps.push(finalStep);

    remainingAmount = realLimitOut + realPoolOut;

    log(
      `[finalizeRoute] Step ${i}: ${step.tokenIn.name} -> ${step.tokenOut.name}, finalAmountOut=${remainingAmount}`,
    );
  }

  log("[finalizeRoute] Complete. finalAmountOut=", remainingAmount);
  return {
    steps: finalSteps,
    finalAmountOut: remainingAmount,
  };
}

export function findBestRoute(
  sourceToken: RouteToken,
  targetToken: RouteToken,
  rawInitialAmount: number,
  poolStore: PoolStoreState,
  limitStore: LimitStoreState,
): CompleteRoute | null {
  log(
    "[findBestRoute] Called with",
    sourceToken.name,
    "->",
    targetToken.name,
    "rawInitialAmount=",
    rawInitialAmount,
  );

  const scaledInitialAmount = Math.floor(rawInitialAmount / SCALE_FACTOR);
  if (scaledInitialAmount <= 0) {
    log("[findBestRoute] scaledInitialAmount <= 0 => no route");
    return null;
  }

  const bfsResult = runBFS(
    sourceToken,
    targetToken,
    scaledInitialAmount,
    poolStore,
    limitStore,
  );
  if (!bfsResult) {
    log("[findBestRoute] BFS returned null => no route");
    return null;
  }

  const finalRoute = finalizeRoute(
    rawInitialAmount,
    bfsResult.steps,
    poolStore,
    limitStore,
  );
  log("[findBestRoute] Final route out:", finalRoute.finalAmountOut);
  return finalRoute;
}
