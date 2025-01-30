import { calculateSwap } from "./swapFunctions";

const MAX_HOP = 5;
const MAX_LIMIT_ORDERS = 10;
const SCALE_FACTOR = 1e5;
const EPSILON = 1.0001;

type PoolIdIndex = Record<string, number>;

let isDebug = false;
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
  steps: RouteStep[];
}

/**
 * Builds a graph where each edge (tokenIn => tokenOut) can have:
 *  * A pool for that pair (if it exists)
 *  * A list of relevant limit orders for that pair
 */
function buildGraph(
  poolStore: PoolStoreState,
  limitStore: LimitStoreState,
  poolIdIndex: PoolIdIndex,
) {
  log("=== buildGraph() start ===");
  log("Pools:", poolStore.poolList.length);
  log("LimitOrders:", limitStore.limitOrders.length);

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
    log(
      `Adding pool: ${pool.poolId}, tokens: ${t0.name}->${t1.name} fee=${pool.fee}`,
    );

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
        `Skipping LimitOrder ${order.orderId} because tokens not found`,
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
      `Added LimitOrder ${order.orderId}, ${tokenIn.name} => ${tokenOut.name}, scaled in=${inAmt}, out=${outAmt}`,
    );
  }

  log("=== buildGraph() complete ===");
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
): RouteStep {
  log(
    `simulateMixedHop: tokenIn=${tokenIn.name}, tokenOut=${edge.tokenOut.name}, scaledAmountIn=${scaledAmountIn}`,
  );

  let bestOut = 0;
  let bestDist = 0;
  let bestOrders: typeof edge.orders = [];

  let poolIndex = -1;
  let poolAvailable = false;
  if (edge.pool) {
    poolIndex = poolIdIndex[edge.pool.poolId] ?? -1;
    if (poolIndex >= 0) {
      const alreadyUsed = ((usedPools >> poolIndex) & 1) === 1;
      poolAvailable = !alreadyUsed;
    }
  }

  log(
    `  Pool Available? ${poolAvailable}, poolId=${edge.pool?.poolId || "None"}`,
  );

  function knapsack(orders: typeof edge.orders, capacity: number) {
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

  log(`  # of limit orders on this edge: ${edge.orders.length}`);

  for (let dist = 0; dist <= scaledAmountIn; dist++) {
    const limitIn = dist;
    const poolIn = scaledAmountIn - dist;

    const { bestVal: limitOut, chosen } = knapsack(edge.orders, limitIn);

    let poolOut = 0;
    if (poolIn > 0 && poolAvailable && edge.pool) {
      const realAmountIn = poolIn * SCALE_FACTOR;
      const poolBuyTokenReserve =
        edge.pool.token0.name === edge.tokenOut.name
          ? Number(edge.pool.token0Amount)
          : Number(edge.pool.token1Amount);

      const poolSellTokenReserve =
        edge.pool.token0.name === edge.tokenOut.name
          ? Number(edge.pool.token1Amount)
          : Number(edge.pool.token0Amount);

      const feeTier = Number(edge.pool.fee);
      const { amountOut } = calculateSwap(
        poolBuyTokenReserve,
        poolSellTokenReserve,
        realAmountIn,
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
    `  Best combination: limitIn=${bestDist}, poolIn=${scaledAmountIn - bestDist}, totalOut=${bestOut}`,
  );

  const routeStep: RouteStep = {
    tokenIn,
    tokenOut: edge.tokenOut,
    orders: bestOrders,
    poolSwap: false,
    amountIn: scaledAmountIn,
    amountOut: bestOut,
  };

  if (poolAvailable && bestDist < scaledAmountIn && edge.pool) {
    routeStep.poolSwap = true;
  }

  log(
    `  => simulateMixedHop returns step: poolSwap=${routeStep.poolSwap}, amountOut=${routeStep.amountOut}, #orders=${bestOrders.length}`,
  );
  return routeStep;
}

export function findBestRoute(
  sourceToken: RouteToken,
  targetToken: RouteToken,
  rawInitialAmount: number,
  poolStore: PoolStoreState,
  limitStore: LimitStoreState,
): CompleteRoute | null {
  log("=== findBestRoute() called ===");
  log(
    `source=${sourceToken.name}, target=${targetToken.name}, rawAmount=${rawInitialAmount}`,
  );

  const scaledInitialAmount = Math.floor(rawInitialAmount / SCALE_FACTOR);
  log(`Scaled initial amount: ${scaledInitialAmount}`);

  if (scaledInitialAmount <= 0) {
    console.warn("Scaled initial amount <= 0, returning null");
    return null;
  }

  const poolIdIndex: PoolIdIndex = {};
  poolStore.poolList.forEach((pool, idx) => {
    poolIdIndex[pool.poolId] = idx;
  });

  log("poolIdIndex mapping:", poolIdIndex);

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

  let bestRoute: CompleteRoute | null = null;

  while (queue.length > 0) {
    const { token, scaledAmount, usedPools, hopCount, steps } = queue.shift()!;
    log(
      `BFS pop: token=${token.name}, scaledAmt=${scaledAmount}, usedPools=0x${usedPools.toString(
        16,
      )}, hopCount=${hopCount}`,
    );

    if (token.tokenId === targetToken.tokenId) {
      const realAmount = scaledAmount * SCALE_FACTOR;
      log(` => Reached target with realAmount=${realAmount}`);
      if (!bestRoute || realAmount > bestRoute.finalAmountOut) {
        bestRoute = {
          steps,
          finalAmountOut: realAmount,
        };
        log(" => New best route found!");
      }
    }

    if (hopCount === MAX_HOP) {
      log(" => Reached max hop, skip expansion");
      continue;
    }

    const edges = graph[token.name] || [];
    log(
      ` => Expanding edges: #${edges.length}, token=${token.name}, scaledAmt=${scaledAmount}`,
    );
    for (const edge of edges) {
      const step = simulateMixedHop(
        token,
        edge,
        scaledAmount,
        usedPools,
        poolIdIndex,
      );
      if (step.amountOut <= 0) {
        log("   -> skip, no output from mixedHop");
        continue;
      }

      let nextUsedPools = usedPools;
      if (step.poolSwap && edge.pool) {
        const idx = poolIdIndex[edge.pool.poolId];
        nextUsedPools = usedPools | (1 << idx);
      }

      const nextHop = hopCount + 1;
      const nextAmount = step.amountOut;
      const nextToken = step.tokenOut;

      if (!visited[nextToken.tokenId][nextUsedPools]) {
        visited[nextToken.tokenId][nextUsedPools] = Array(MAX_HOP + 1).fill(0);
      }
      const oldAmount = visited[nextToken.tokenId][nextUsedPools][nextHop] || 0;

      if (nextAmount > oldAmount * EPSILON) {
        log(
          `   -> BFS push: nextToken=${nextToken.name}, nextAmt=${nextAmount}, usedPools=0x${nextUsedPools.toString(
            16,
          )}, hop=${nextHop}`,
        );
        visited[nextToken.tokenId][nextUsedPools][nextHop] = nextAmount;
        queue.push({
          token: nextToken,
          scaledAmount: nextAmount,
          usedPools: nextUsedPools,
          hopCount: nextHop,
          steps: [...steps, step],
        });
      } else {
        log(
          `   -> skip, improvement is too small or no improvement (nextAmt=${nextAmount} vs oldAmt=${oldAmount})`,
        );
      }
    }
  }

  log("=== BFS finished ===");
  if (!bestRoute) {
    log("No route found, returning null");
  } else {
    log(`Best finalAmountOut: ${bestRoute.finalAmountOut}`);
    log("Best Route Steps:", bestRoute.steps);
  }
  return bestRoute;
}
