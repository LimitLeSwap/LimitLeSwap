import { useLimitStore } from "@/lib/stores/limitStore";
import { usePoolStore } from "@/lib/stores/poolStore";
import { PrivateKey } from "o1js";
import { findBestRoute } from "../utils/findRoute";

function initializeStores() {
  const poolStore = usePoolStore.getState();
  const limitStore = useLimitStore.getState();

  poolStore.setTokenList([]);
  poolStore.setPoolList([]);
  poolStore.setPositionList([]);
  limitStore.setLimitOrders([]);

  return { poolStore, limitStore };
}

const currentBlockHeight = 1000;

function printRouteResult(description: string, bestRoute: any) {
  console.log(description);
  if (!bestRoute) {
    console.log("No route found!");
    return;
  }

  console.log(`Final Amount Out: ${bestRoute.finalAmountOut}`);
  console.log("Steps:");
  bestRoute.steps.forEach((step: any, index: number) => {
    console.log(`Step ${index + 1}:`);
    console.log(`  Token In: ${step.tokenIn.name}`);
    console.log(`  Token Out: ${step.tokenOut.name}`);
    console.log(`  Amount In: ${step.amountIn}`);
    console.log(`  Amount Out: ${step.amountOut}`);
    console.log(`  Pool Swap: ${step.poolSwap}`);
    console.log(`  Orders:`);
    step.orders.forEach((order: any) => {
      console.log(`    Order ID: ${order.orderId}`);
      console.log(`    Amount In: ${order.tokenInAmount}`);
      console.log(`    Amount Out: ${order.tokenOutAmount}`);
      console.log(`    Owner: ${order.owner.toBase58()}`);
    });
  });
  console.log("\n");
}

/**
 * SCENARIO 1:
 * Simple single-hop route with beneficial limit orders.
 * TOKEN_A -> TOKEN_C directly with a good limit order.
 */
function scenarioSingleHopWithLimitOrders() {
  const { poolStore, limitStore } = initializeStores();

  const tokenA = { name: "TOKEN_A", icon: "A.png", tokenId: "1" };
  const tokenB = { name: "TOKEN_B", icon: "B.png", tokenId: "2" };
  const tokenC = { name: "TOKEN_C", icon: "C.png", tokenId: "3" };

  const poolAB = {
    poolId: "poolAB",
    token0: tokenA,
    token1: tokenB,
    token0Amount: "1000000",
    token1Amount: "1000000",
    fee: "3",
    lpTokenSupply: "1000000000",
  };

  const limitOrders = [
    {
      orderId: 1,
      tokenIn: "1",
      tokenOut: "3",
      tokenInAmount: "10000",
      tokenOutAmount: "11000",
      owner: PrivateKey.random().toPublicKey(),
      expiration: "9999999",
      isActive: true,
    },
    {
      orderId: 2,
      tokenIn: "1",
      tokenOut: "3",
      tokenInAmount: "10000",
      tokenOutAmount: "10050",
      owner: PrivateKey.random().toPublicKey(),
      expiration: "9999999",
      isActive: true,
    },
  ];

  poolStore.setTokenList([tokenA, tokenB, tokenC]);
  poolStore.setPoolList([poolAB]);
  limitStore.setLimitOrders(limitOrders);

  const bestRoute = findBestRoute(
    tokenA,
    tokenC,
    10000,
    poolStore,
    limitStore,
    currentBlockHeight,
  );
  printRouteResult(
    "SCENARIO 1: Single-hop with beneficial limit orders",
    bestRoute,
  );
}

/**
 * SCENARIO 2:
 * Multi-hop scenario (up to 5 hops).
 * Tokens: A -> B -> C -> D -> E -> F
 * Pools connect these tokens in a chain: A-B, B-C, C-D, D-E, E-F.
 * We also add some limit orders that might allow skipping some hops if beneficial.
 */
function scenarioMultiHopRoute() {
  const { poolStore, limitStore } = initializeStores();

  const tokenA = { name: "TOKEN_A", icon: "A.png", tokenId: "1" };
  const tokenB = { name: "TOKEN_B", icon: "B.png", tokenId: "2" };
  const tokenC = { name: "TOKEN_C", icon: "C.png", tokenId: "3" };
  const tokenD = { name: "TOKEN_D", icon: "D.png", tokenId: "4" };
  const tokenE = { name: "TOKEN_E", icon: "E.png", tokenId: "5" };
  const tokenF = { name: "TOKEN_F", icon: "F.png", tokenId: "6" };

  // Create a chain of pools: A-B, B-C, C-D, D-E, E-F
  const pools = [
    {
      poolId: "poolAB",
      token0: tokenA,
      token1: tokenB,
      token0Amount: "500000",
      token1Amount: "500000",
      fee: "3",
      lpTokenSupply: "1000000000",
    },
    {
      poolId: "poolBC",
      token0: tokenB,
      token1: tokenC,
      token0Amount: "400000",
      token1Amount: "800000",
      fee: "3",
      lpTokenSupply: "1000000000",
    },
    {
      poolId: "poolCD",
      token0: tokenC,
      token1: tokenD,
      token0Amount: "300000",
      token1Amount: "900000",
      fee: "3",
      lpTokenSupply: "1000000000",
    },
    {
      poolId: "poolDE",
      token0: tokenD,
      token1: tokenE,
      token0Amount: "600000",
      token1Amount: "600000",
      fee: "3",
      lpTokenSupply: "1000000000",
    },
    {
      poolId: "poolEF",
      token0: tokenE,
      token1: tokenF,
      token0Amount: "200000",
      token1Amount: "1000000",
      fee: "3",
      lpTokenSupply: "1000000000",
    },
  ];

  // Limit orders that might allow skipping tokens:
  // For example, a direct limit order A -> D that could skip B,C if beneficial
  // and a direct limit order D -> F that could skip E.
  const limitOrders = [
    {
      orderId: 1,
      tokenIn: "1", // A
      tokenOut: "4", // D
      tokenInAmount: "10000",
      tokenOutAmount: "20000", // Very beneficial compared to going through B,C
      owner: PrivateKey.random().toPublicKey(),
      expiration: "9999999",
      isActive: true,
    },
    {
      orderId: 2,
      tokenIn: "4", // D
      tokenOut: "6", // F
      tokenInAmount: "20000",
      tokenOutAmount: "30000", // Great rate, skipping E
      owner: PrivateKey.random().toPublicKey(),
      expiration: "9999999",
      isActive: true,
    },
  ];

  poolStore.setTokenList([tokenA, tokenB, tokenC, tokenD, tokenE, tokenF]);
  poolStore.setPoolList(pools);
  limitStore.setLimitOrders(limitOrders);

  // Without the limit orders, a route A->B->C->D->E->F might yield less output.
  // With the limit orders A->D and D->F, we can achieve a 2-hop route (A->D limit order, D->F limit order).

  const bestRoute = findBestRoute(
    tokenA,
    tokenF,
    10000,
    poolStore,
    limitStore,
    currentBlockHeight,
  );
  printRouteResult(
    "SCENARIO 2: Multi-hop (up to 5 hops) with beneficial limit orders skipping intermediates",
    bestRoute,
  );
}

/**
 * SCENARIO 3:
 * Limit orders only, no pools.
 * The best route is actually just a chain of limit orders from A -> X -> Y -> F
 * without any pools.
 * We set no pools but create multiple limit orders that chain the tokens.
 */
function scenarioLimitOrdersOnly() {
  const { poolStore, limitStore } = initializeStores();

  const tokenA = { name: "TOKEN_A", icon: "A.png", tokenId: "1" };
  const tokenX = { name: "TOKEN_X", icon: "X.png", tokenId: "2" };
  const tokenY = { name: "TOKEN_Y", icon: "Y.png", tokenId: "3" };
  const tokenF = { name: "TOKEN_F", icon: "F.png", tokenId: "4" };

  // No pools
  poolStore.setTokenList([tokenA, tokenX, tokenY, tokenF]);

  // Limit orders that chain A->X, X->Y, Y->F with good rates
  const limitOrders = [
    {
      orderId: 1,
      tokenIn: "1", // A
      tokenOut: "2", // X
      tokenInAmount: "10000",
      tokenOutAmount: "12000",
      owner: PrivateKey.random().toPublicKey(),
      expiration: "9999999",
      isActive: true,
    },
    {
      orderId: 2,
      tokenIn: "2", // X
      tokenOut: "3", // Y
      tokenInAmount: "12000",
      tokenOutAmount: "15000",
      owner: PrivateKey.random().toPublicKey(),
      expiration: "9999999",
      isActive: true,
    },
    {
      orderId: 3,
      tokenIn: "3", // Y
      tokenOut: "4", // F
      tokenInAmount: "15000",
      tokenOutAmount: "20000",
      owner: PrivateKey.random().toPublicKey(),
      expiration: "9999999",
      isActive: true,
    },
  ];

  limitStore.setLimitOrders(limitOrders);

  const bestRoute = findBestRoute(
    tokenA,
    tokenF,
    10000,
    poolStore,
    limitStore,
    currentBlockHeight,
  );
  printRouteResult(
    "SCENARIO 3: Limit orders only (no pools) forming a multi-hop chain",
    bestRoute,
  );
}

/**
 * SCENARIO 4:
 * Pools alone are better. We create a direct multi-pool route that yields more than any limit order.
 * Limit orders exist but are less favorable.
 */
function scenarioPoolsBetterThanLimit() {
  const { poolStore, limitStore } = initializeStores();

  const tokenA = { name: "TOKEN_A", icon: "A.png", tokenId: "1" };
  const tokenB = { name: "TOKEN_B", icon: "B.png", tokenId: "2" };
  const tokenC = { name: "TOKEN_C", icon: "C.png", tokenId: "3" };

  // A single pool A <-> C with very large reserves, yielding a great price.
  const poolAC = {
    poolId: "poolAC",
    token0: tokenA,
    token1: tokenC,
    token0Amount: "100000000", // huge
    token1Amount: "100000000",
    fee: "3",
    lpTokenSupply: "1000000000",
  };

  // Add a limit order A->C but with worse rate than the pool
  const limitOrders = [
    {
      orderId: 1,
      tokenIn: "1", // A
      tokenOut: "3", // C
      tokenInAmount: "10000",
      tokenOutAmount: "9000", // Worse than the pool
      owner: PrivateKey.random().toPublicKey(),
      expiration: "9999999",
      isActive: true,
    },
  ];

  poolStore.setTokenList([tokenA, tokenB, tokenC]);
  poolStore.setPoolList([poolAC]);
  limitStore.setLimitOrders(limitOrders);

  const bestRoute = findBestRoute(
    tokenA,
    tokenC,
    10000,
    poolStore,
    limitStore,
    currentBlockHeight,
  );
  printRouteResult(
    "SCENARIO 4: Pools yield a better rate than limit orders",
    bestRoute,
  );
}

/**
 * SCENARIO 5:
 * Many limit orders (more than 10) on the same pair. Only the best 10 or fewer can be used.
 * Ensure that the best orders are chosen first.
 * We place 12 limit orders from A->B with varying prices, ensuring that only the top 10 best-priced can be used.
 */
function scenarioManyLimitOrders() {
  const { poolStore, limitStore } = initializeStores();

  const tokenA = { name: "TOKEN_A", icon: "A.png", tokenId: "1" };
  const tokenB = { name: "TOKEN_B", icon: "B.png", tokenId: "2" };

  // No pools, just limit orders
  poolStore.setTokenList([tokenA, tokenB]);

  // 12 limit orders with descending quality:
  // The best order gives A->B at a ratio of 1:2,
  // then slightly worse until the last one gives 1:1.05
  const limitOrders = [];
  for (let i = 0; i < 12; i++) {
    // tokenInAmount = 1000, tokenOutAmount decreases with i
    const ratio = 2 - i * 0.1; // best is 2.0, worst ~0.9
    const outAmt = Math.floor(1000 * ratio);
    limitOrders.push({
      orderId: i + 1,
      tokenIn: "1",
      tokenOut: "2",
      tokenInAmount: "1000",
      tokenOutAmount: outAmt.toString(),
      owner: PrivateKey.random().toPublicKey(),
      expiration: "9999999",
      isActive: true,
    });
  }

  limitStore.setLimitOrders(limitOrders);

  // We have 10,000 of A, can fill up to 10 orders fully (10 * 1000 = 10,000).
  // The function should pick the top 10 orders with the best ratio.
  const bestRoute = findBestRoute(
    tokenA,
    tokenB,
    10000,
    poolStore,
    limitStore,
    currentBlockHeight,
  );
  printRouteResult(
    "SCENARIO 5: More than 10 limit orders, only best 10 chosen",
    bestRoute,
  );
}

function runAllScenarios() {
  scenarioSingleHopWithLimitOrders();
  scenarioMultiHopRoute();
  scenarioLimitOrdersOnly();
  scenarioPoolsBetterThanLimit();
  scenarioManyLimitOrders();
}

runAllScenarios();
