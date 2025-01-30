// Customized knapsack algorithm to find the best route for a swap
// based on the available pools and limit orders
// To find the best route, maybe we can use a heuristic approach

import { calculateSwap } from "./swapFunctions";

const MAX_HOP = 5;
const MAX_LIMIT_ORDERS = 10;

const SCALE_FACTOR = 1e5;
const EPSILON = 1.001;

const debug = true;

function log(...args: any[]) {
  if (debug) {
    console.log(...args);
  }
}

function table(data: any) {
  if (debug) {
    console.table(data);
  }
}

interface ParentInfo {
  prevHop: number;
  prevTokenId: string;
  step: RouteStep;
}

interface PathState {
  visited: Set<string>;
  currentPath: string[];
}

function buildGraph(poolStore: PoolStoreState, limitStore: LimitStoreState) {
  log("=== Building Graph ===");
  log(
    `Number of pools: ${poolStore.poolList.length}, Number of limit orders: ${limitStore.limitOrders.length}`,
  );

  const graph: Record<
    string,
    { token: RouteToken; simulateHop: (scaledIn: number) => RouteStep[] }[]
  > = {};

  for (const pool of poolStore.poolList) {
    log(
      `- Processing Pool: [${pool.token0.name} - ${pool.token1.name}], Fee: ${pool.fee}`,
    );
    const t0 = pool.token0;
    const t1 = pool.token1;
    addPoolEdge(graph, t0, t1, pool);
    addPoolEdge(graph, t1, t0, pool);
  }

  for (const order of limitStore.limitOrders) {
    log(`- Processing Limit Order: ID=${order.orderId}`);
    const tokenIn = poolStore.tokenList.find(
      (t) => t.tokenId === order.tokenInId,
    );
    const tokenOut = poolStore.tokenList.find(
      (t) => t.tokenId === order.tokenOutId,
    );
    if (!tokenIn || !tokenOut) {
      log(`  Skipping order ID=${order.orderId} (tokenIn/tokenOut not found)`);
      continue;
    }

    addLimitOrderEdge(graph, tokenIn, tokenOut, limitStore);
  }

  log("=== Graph Construction Complete ===");
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

  log(
    `  Adding pool edge ${tokenIn.name} -> ${tokenOut.name}, pool ID: ${pool.poolId}`,
  );

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

  log(`  Adding limit order edge ${tokenIn.name} -> ${tokenOut.name}`);

  graph[tokenIn.name].push({
    token: tokenOut,
    simulateHop: (scaledAmountIn: number) => {
      log(
        `    Simulating limit order hop from ${tokenIn.name} to ${tokenOut.name} with scaledAmountIn=${scaledAmountIn}`,
      );

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

      log(
        `    Relevant Orders found: ${relevantOrders.length}`,
        relevantOrders,
      );

      const n = relevantOrders.length;

      log("    Creating DP table:", {
        ordersLength: n,
        maxScaledAmountIn: scaledAmountIn,
        maxLimitOrders: MAX_LIMIT_ORDERS,
      });

      const dp: number[][][] = Array.from({ length: n + 1 }, () =>
        Array.from({ length: scaledAmountIn + 1 }, () =>
          Array.from({ length: MAX_LIMIT_ORDERS + 1 }, () => 0),
        ),
      );

      // DP[i][j][k] = maximum amountOut achievable using the first i orders,
      // with total scaled amountIn = j and using k orders
      for (let i = 1; i <= n; i++) {
        const { tokenInAmount, tokenOutAmount } = relevantOrders[i - 1];

        // log(
        //   `    [i=${i}] tokenInAmount=${tokenInAmount}, tokenOutAmount=${tokenOutAmount}`,
        // );

        for (let j = 0; j <= scaledAmountIn; j++) {
          for (let k = 0; k <= MAX_LIMIT_ORDERS; k++) {
            dp[i][j][k] = dp[i - 1][j][k];

            if (tokenOutAmount <= j && k > 0) {
              // log(
              //   `      loooking for [j=${j}, k=${k}] tokenInAmount=${tokenInAmount}, tokenOutAmount=${tokenOutAmount}`,
              // );

              const picked =
                dp[i - 1][j - tokenOutAmount][k - 1] + tokenInAmount;
              dp[i][j][k] = Math.max(dp[i][j][k], picked);

              // log(`      picked=${picked}, dp[i][j][k]=${dp[i][j][k]}`);
            }
          }
        }
      }

      let bestValue = 0;
      let bestJ = 0;
      let bestK = 0;

      log("    DP Table after processing all orders:");
      table(dp);

      for (let j = 0; j <= scaledAmountIn; j++) {
        for (let k = 0; k <= MAX_LIMIT_ORDERS; k++) {
          if (dp[n][j][k] > bestValue) {
            bestValue = dp[n][j][k];
            bestJ = j;
            bestK = k;
          }
        }
      }

      log(`    Best DP Value: ${bestValue} (at j=${bestJ}, k=${bestK})`);

      const orders = [];
      let i = n;
      let j = bestJ;
      let k = bestK;
      while (i > 0 && k > 0) {
        if (dp[i][j][k] !== dp[i - 1][j][k]) {
          const ord = relevantOrders[i - 1];
          orders.push(ord);
          j -= ord.tokenOutAmount;
          k -= 1;
        }
        i--;
      }
      orders.reverse();

      log(`    Selected Orders: `, orders);

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
  log("=== findBestRoute Start ===");
  table({
    sourceToken,
    targetToken,
    rawInitialAmount,
  });

  log("PoolStoreState:", poolStore);
  log("LimitStoreState:", limitStore);

  const scaledInitialAmount = Math.floor(rawInitialAmount / SCALE_FACTOR);
  log(`Scaled initial amount: ${scaledInitialAmount}`);

  if (scaledInitialAmount <= 0) {
    log("Scaled initial amount <= 0, returning null.");
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

  const parent = Array.from({ length: MAX_HOP + 1 }, () =>
    new Array<ParentInfo | undefined>(nTokens).fill(undefined),
  );

  const pathStates: PathState[][] = Array.from({ length: MAX_HOP + 1 }, () =>
    new Array<PathState>(nTokens).fill({ visited: new Set(), currentPath: [] }),
  );

  const sourceIdx = tokenIdToIndex[sourceToken.tokenId];
  dp[0][sourceIdx] = scaledInitialAmount;
  pathStates[0][sourceIdx].visited.add(sourceToken.tokenId);
  pathStates[0][sourceIdx].currentPath.push(sourceToken.tokenId);

  for (let h = 0; h < MAX_HOP; h++) {
    for (let i = 0; i < nTokens; i++) {
      const curAmount = dp[h][i];
      if (curAmount <= 0) continue;

      const curToken = poolStore.tokenList[i];
      const currentPathState = pathStates[h][i];

      if (curAmount > dp[h + 1][i]) {
        dp[h + 1][i] = curAmount;
        parent[h + 1][i] = parent[h][i];
        pathStates[h + 1][i] = {
          visited: new Set(currentPathState.visited),
          currentPath: [...currentPathState.currentPath],
        };
      }

      const edges = graph[curToken.name] || [];
      log(
        `At hop=${h}, token=${curToken.name} (idx=${i}), curAmount=${curAmount}. Edges:`,
        edges.map((e) => e.token.name),
      );

      for (const edge of edges) {
        const nextTokenIdx = tokenIdToIndex[edge.token.tokenId];
        if (currentPathState.visited.has(edge.token.tokenId)) {
          log(`Skipping ${edge.token.name} as it's already in path`);
          continue;
        }
        const steps = edge.simulateHop(curAmount);

        steps.forEach((st) => {
          log(
            `  Simulating hop ${curToken.name} -> ${st.tokenOut.name}, amountOut=${st.amountOut}`,
          );

          if (st.amountOut <= dp[h + 1][nextTokenIdx] * EPSILON) {
            return;
          }

          if (st.amountOut > dp[h + 1][nextTokenIdx]) {
            dp[h + 1][nextTokenIdx] = st.amountOut;
            parent[h + 1][nextTokenIdx] = {
              prevHop: h,
              prevTokenId: curToken.tokenId,
              step: st,
            };

            const newVisited = new Set<string>();
            Array.from(currentPathState.visited).forEach((id) =>
              newVisited.add(id),
            );
            newVisited.add(edge.token.tokenId);

            pathStates[h + 1][nextTokenIdx] = {
              visited: newVisited,
              currentPath: [
                ...currentPathState.currentPath,
                edge.token.tokenId,
              ],
            };
          }
        });
      }
    }
  }

  const targetIdx = tokenIdToIndex[targetToken.tokenId];
  let bestHop = 0;
  let bestScaledOut = 0;

  log("=== DP Table ===");
  table(dp);

  for (let h = 0; h <= MAX_HOP; h++) {
    if (dp[h][targetIdx] > bestScaledOut) {
      bestScaledOut = dp[h][targetIdx];
      bestHop = h;
    }
  }

  log(`Best scaled out: ${bestScaledOut} at hop=${bestHop}`);

  if (bestScaledOut <= 0) {
    log("No viable route found, returning null.");
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

  log("=== Route reconstruction complete ===");
  log("Route steps:", routeSteps);
  log(`Final amount out: ${finalAmountOut}`);

  return {
    steps: routeSteps,
    finalAmountOut,
  };
}
