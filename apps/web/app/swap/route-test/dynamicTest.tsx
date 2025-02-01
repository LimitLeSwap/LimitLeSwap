"use client";

import React, { useEffect, useState } from "react";
import { PrivateKey } from "o1js";

import { MockPoolStore, MockLimitStore } from "./mockStores";
import { findBestRoute } from "../utils/findRoute";

function printRouteResult(
  description: string,
  bestRoute: any,
  orderList: any,
  tokenList: any,
) {
  if (!bestRoute) {
    return `${description}\nNo route found!\n`;
  }

  let result = `${description}\nFinal Amount Out: ${bestRoute.finalAmountOut}\nSteps:\n`;
  bestRoute.steps.forEach((step: any, index: number) => {
    result += `Step ${index + 1}:\n`;
    result += `  Token In: ${step.tokenIn.name}\n`;
    result += `  Token Out: ${step.tokenOut.name}\n`;
    result += `  Amount In: ${step.amountIn}\n`;
    result += `  Amount Out: ${step.amountOut}\n`;
    result += `  Pool Swap: ${step.poolSwap}\n`;
    if (step.orders && step.orders.length > 0) {
      result += `  Orders:\n`;
      step.orders.forEach((order: any) => {
        result += `    Order ID: ${order.orderId}\n`;
        const limitOrder = orderList.find(
          (o: any) => o.tokenId === order.tokenIn,
        );
        const tokenIn = tokenList.find(
          (t: any) => t.tokenId === limitOrder?.tokenIn,
        );
        const tokenOut = tokenList.find(
          (t: any) => t.tokenId === limitOrder?.tokenOut,
        );
        result += `    Token In: ${tokenIn?.name}\n`;
        result += `    Token Out: ${tokenOut?.name}\n`;
        result += `    Amount In: ${order.tokenInAmount}\n`;
        result += `    Amount Out: ${order.tokenOutAmount}\n`;
      });
    }
  });
  return result + "\n";
}

export default function TestScenarios() {
  const [results, setResults] = useState<string[]>([]);

  const runScenarios = () => {
    const poolStore = new MockPoolStore();
    const limitStore = new MockLimitStore();

    const scenarioSingleHopWithLimitOrders = () => {
      poolStore.setTokenList([]);
      poolStore.setPoolList([]);
      poolStore.setPositionList([]);
      limitStore.setLimitOrders([]);

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
          orderId: "1",
          tokenInId: "1",
          tokenOutId: "3",
          tokenInAmount: "10000",
          tokenOutAmount: "11000",
          owner: PrivateKey.random().toPublicKey().toBase58(),
          expireBlock: 9999999,
          createdAt: "2021",
        },
        {
          orderId: "2",
          tokenInId: "1",
          tokenOutId: "3",
          tokenInAmount: "10000",
          tokenOutAmount: "10050",
          owner: PrivateKey.random().toPublicKey().toBase58(),
          expireBlock: 9999999,
          createdAt: "2021",
        },
      ];

      poolStore.setTokenList([tokenA, tokenB, tokenC]);
      poolStore.setPoolList([poolAB]);
      limitStore.setLimitOrders(limitOrders);

      const bestRoute = findBestRoute(
        tokenA,
        tokenC,
        10000,
        {
          tokenList: poolStore.getTokenList(),
          poolList: poolStore.getPoolList(),
          positionList: poolStore.getPositionList(),
        },
        {
          limitOrders: limitStore.getLimitOrders(),
        },
      );

      return printRouteResult(
        "SCENARIO 1: Single-hop with beneficial limit orders",
        bestRoute,
        limitStore.getLimitOrders(),
        poolStore.getTokenList(),
      );
    };

    const scenarioMultiHopRoute = () => {
      poolStore.setTokenList([]);
      poolStore.setPoolList([]);
      limitStore.setLimitOrders([]);

      const tokenA = { name: "TOKEN_A", icon: "A.png", tokenId: "1" };
      const tokenB = { name: "TOKEN_B", icon: "B.png", tokenId: "2" };
      const tokenC = { name: "TOKEN_C", icon: "C.png", tokenId: "3" };
      const tokenD = { name: "TOKEN_D", icon: "D.png", tokenId: "4" };
      const tokenE = { name: "TOKEN_E", icon: "E.png", tokenId: "5" };
      const tokenF = { name: "TOKEN_F", icon: "F.png", tokenId: "6" };

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

      const limitOrders = [
        {
          orderId: "1",
          tokenInId: "1",
          tokenOutId: "4",
          tokenInAmount: "10000",
          tokenOutAmount: "20000",
          owner: PrivateKey.random().toPublicKey().toBase58(),
          expireBlock: 9999999,
          createdAt: "2021",
        },
        {
          orderId: "2",
          tokenInId: "4",
          tokenOutId: "6",
          tokenInAmount: "20000",
          tokenOutAmount: "30000",
          owner: PrivateKey.random().toPublicKey().toBase58(),
          expireBlock: 9999999,
          createdAt: "2021",
        },
      ];

      poolStore.setTokenList([tokenA, tokenB, tokenC, tokenD, tokenE, tokenF]);
      poolStore.setPoolList(pools);
      limitStore.setLimitOrders(limitOrders);

      const bestRoute = findBestRoute(
        tokenA,
        tokenF,
        10000,
        {
          tokenList: poolStore.getTokenList(),
          poolList: poolStore.getPoolList(),
          positionList: poolStore.getPositionList(),
        },
        {
          limitOrders: limitStore.getLimitOrders(),
        },
      );

      return printRouteResult(
        "SCENARIO 2: Multi-hop route with limit orders",
        bestRoute,
        limitStore.getLimitOrders(),
        poolStore.getTokenList(),
      );
    };

    const scenarioLimitOrdersOnly = () => {
      poolStore.setTokenList([]);
      poolStore.setPoolList([]);
      limitStore.setLimitOrders([]);

      const tokenA = { name: "TOKEN_A", icon: "A.png", tokenId: "1" };
      const tokenX = { name: "TOKEN_X", icon: "X.png", tokenId: "2" };
      const tokenY = { name: "TOKEN_Y", icon: "Y.png", tokenId: "3" };
      const tokenF = { name: "TOKEN_F", icon: "F.png", tokenId: "4" };

      // No pools
      poolStore.setTokenList([tokenA, tokenX, tokenY, tokenF]);

      // Limit orders that chain A->X, X->Y, Y->F with good rates
      const limitOrders = [
        {
          orderId: "1",
          tokenInId: "1", // A
          tokenOutId: "2", // X
          tokenInAmount: "10000",
          tokenOutAmount: "12000",
          owner: PrivateKey.random().toPublicKey().toBase58(),
          expireBlock: 9999999,
          createdAt: "2021",
        },
        {
          orderId: "2",
          tokenInId: "2", // X
          tokenOutId: "3", // Y
          tokenInAmount: "12000",
          tokenOutAmount: "15000",
          owner: PrivateKey.random().toPublicKey().toBase58(),
          expireBlock: 9999999,
          createdAt: "2021",
        },
        {
          orderId: "3",
          tokenInId: "3", // Y
          tokenOutId: "4", // F
          tokenInAmount: "15000",
          tokenOutAmount: "20000",
          owner: PrivateKey.random().toPublicKey().toBase58(),
          expireBlock: 9999999,
          createdAt: "2021",
        },
      ];

      limitStore.setLimitOrders(limitOrders);

      const bestRoute = findBestRoute(
        tokenA,
        tokenF,
        10000,
        {
          tokenList: poolStore.getTokenList(),
          poolList: poolStore.getPoolList(),
          positionList: poolStore.getPositionList(),
        },
        {
          limitOrders: limitStore.getLimitOrders(),
        },
      );
      return printRouteResult(
        "SCENARIO 3: Limit orders only (no pools) forming a multi-hop chain",
        bestRoute,
        limitStore.getLimitOrders(),
        poolStore.getTokenList(),
      );
    };

    const scenarioPoolsBetterThanLimit = () => {
      poolStore.setTokenList([]);
      poolStore.setPoolList([]);

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
          orderId: "1",
          tokenInId: "1", // A
          tokenOutId: "3", // C
          tokenInAmount: "10000",
          tokenOutAmount: "9000", // Worse than the pool
          owner: PrivateKey.random().toPublicKey().toBase58(),
          expireBlock: 9999999,
          createdAt: "2021",
        },
      ];

      poolStore.setTokenList([tokenA, tokenB, tokenC]);
      poolStore.setPoolList([poolAC]);
      limitStore.setLimitOrders(limitOrders);

      const bestRoute = findBestRoute(
        tokenA,
        tokenC,
        10000,
        {
          tokenList: poolStore.getTokenList(),
          poolList: poolStore.getPoolList(),
          positionList: poolStore.getPositionList(),
        },
        {
          limitOrders: limitStore.getLimitOrders(),
        },
      );
      return printRouteResult(
        "SCENARIO 4: Pools yield a better rate than limit orders",
        bestRoute,
        limitStore.getLimitOrders(),
        poolStore.getTokenList(),
      );
    };

    const scenarioManyLimitOrders = () => {
      poolStore.setTokenList([]);
      poolStore.setPoolList([]);

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
          orderId: "i" + 1,
          tokenInId: "1",
          tokenOutId: "2",
          tokenInAmount: "1000",
          tokenOutAmount: outAmt.toString(),
          owner: PrivateKey.random().toPublicKey().toBase58(),
          expireBlock: 9999999,
          createdAt: "2021",
        });
      }

      limitStore.setLimitOrders(limitOrders);

      // We have 10,000 of A, can fill up to 10 orders fully (10 * 1000 = 10,000).
      // The function should pick the top 10 orders with the best ratio.
      const bestRoute = findBestRoute(
        tokenA,
        tokenB,
        10000,
        {
          tokenList: poolStore.getTokenList(),
          poolList: poolStore.getPoolList(),
          positionList: poolStore.getPositionList(),
        },
        {
          limitOrders: limitStore.getLimitOrders(),
        },
      );
      return printRouteResult(
        "SCENARIO 5: More than 10 limit orders, only best 10 chosen",
        bestRoute,
        limitStore.getLimitOrders(),
        poolStore.getTokenList(),
      );
    };

    const scenarioResults: string[] = [];
    scenarioResults.push(scenarioSingleHopWithLimitOrders());
    scenarioResults.push(scenarioMultiHopRoute());
    scenarioResults.push(scenarioLimitOrdersOnly());
    scenarioResults.push(scenarioPoolsBetterThanLimit());
    scenarioResults.push(scenarioManyLimitOrders());

    setResults(scenarioResults);
  };

  useEffect(() => {
    runScenarios();
  }, []);

  return (
    <div>
      <h1>Test Scenarios</h1>
      {results.map((result, index) => (
        <pre key={index}>{result}</pre>
      ))}
    </div>
  );
}
