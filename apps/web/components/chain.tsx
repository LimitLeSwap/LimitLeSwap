import { useClientStore } from "@/lib/stores/client";
import { usePoolStore } from "@/lib/stores/poolStore";
import { useWalletStore } from "@/lib/stores/wallet";
import { tokens } from "@/lib/tokens";
import { BalancesKey, TokenId } from "@proto-kit/library";
import { PublicKey } from "o1js";
import { useEffect, useRef } from "react";
import isEqual from "lodash.isequal";

export interface ChainProps {
  height?: string;
}

export interface GetTokenListResponse {
  data: {
    tokens: [
      {
        tokenId: string;
        updatedAt: string;
        totalSupply: number;
        decimals: number;
        createdAt: string;
      },
    ];
  };
}

export interface GetPoolListResponse {
  data: {
    pools: [
      {
        totalLpAmount: string;
        token1Id: string;
        token1Amount: string;
        token0Id: string;
        token0Amount: string;
        poolId: string;
        feePercentage: string;
      },
    ];
  };
}

export function Chain({ height }: ChainProps) {
  const client = useClientStore();
  const poolStore = usePoolStore();
  const walletStore = useWalletStore();
  const { wallet } = walletStore;

  const previousTokenListRef = useRef<Token[]>([]);
  const previousPoolListRef = useRef<Pool[]>([]);
  const previousPositionListRef = useRef<Position[]>([]);

  useEffect(() => {
    if (!client.client) return;
    (async () => {
      const graphql = process.env.NEXT_PUBLIC_PROTOKIT_PROCESSOR_GRAPHQL_URL;

      if (graphql === undefined) {
        throw new Error(
          "Environment variable NEXT_PUBLIC_PROTOKIT_PROCESSOR_GRAPHQL_URL not set, can't execute graphql requests",
        );
      }

      const tokenList: Token[] = [];

      const tokenListResponse = await fetch(graphql, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `query GetTokenList {
  tokens(orderBy: {id: asc}, where: {id: {gt: 1}}) {
    updatedAt
    totalSupply
    tokenId
    decimals
    createdAt
  }
}`,
        }),
      });

      let { data: tokenListData } =
        (await tokenListResponse.json()) as GetTokenListResponse;

      for (let i = 0; i < tokenListData.tokens.length; i++) {
        const token = tokenListData.tokens[i];
        tokenList.push({
          name: tokens[i].name,
          icon: tokens[i].icon,
          tokenId: token.tokenId,
        });
      }

      if (!isEqual(previousTokenListRef.current, tokenList)) {
        poolStore.setTokenList(tokenList);
        previousTokenListRef.current = tokenList;
      }

      const poolList: Pool[] = [];
      const positionList: Position[] = [];

      const poolListResponse = await fetch(graphql, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `query GetPoolList {
  pools {
    totalLpAmount
    token1Id
    token1Amount
    token0Id
    token0Amount
    poolId
    feePercentage
  }
}`,
        }),
      });

      const { data: poolListData } =
        (await poolListResponse.json()) as GetPoolListResponse;

      for (let i = 0; i < poolListData.pools.length; i++) {
        const pool = poolListData.pools[i];
        const poolId = pool.poolId;

        poolList.push({
          poolId: pool.poolId,
          token0: tokenList.find((token) => token.tokenId === pool.token0Id)!,
          token1: tokenList.find((token) => token.tokenId === pool.token1Id)!,
          token0Amount: pool.token0Amount,
          token1Amount: pool.token1Amount,
          fee: pool.feePercentage,
          lpTokenSupply: pool.totalLpAmount,
        });

        if (wallet) {
          const pool = poolList[i];
          const userKey = BalancesKey.from(
            TokenId.from(poolId),
            PublicKey.fromBase58(wallet),
          );
          const userLpBalance =
            await client.client!.query.runtime.Balances.balances.get(userKey);
          if (!userLpBalance || userLpBalance.toString() === "0") {
            continue;
          }

          const position: Position = {
            poolId: poolId,
            token0: pool.token0,
            token1: pool.token1,
            token0Amount: (
              (Number(pool.token0Amount) * Number(userLpBalance.toString())) /
              Number(pool.lpTokenSupply)
            ).toString(),
            token1Amount: (
              (Number(pool.token1Amount) * Number(userLpBalance.toString())) /
              Number(pool.lpTokenSupply)
            ).toString(),
            lpTokenAmount: userLpBalance.toString(),
            lpTokenTotalSupply: pool.lpTokenSupply,
          };
          positionList.push(position);
        }
      }

      if (!isEqual(previousPoolListRef.current, poolList)) {
        poolStore.setPoolList(poolList);
        previousPoolListRef.current = poolList;
      }

      if (!isEqual(previousPositionListRef.current, positionList)) {
        poolStore.setPositionList(positionList);
        previousPositionListRef.current = positionList;
      }
    })();
  }, [height, client.client]);
  return (
    <div className="flex items-center">
      <div className={"mr-1 h-2 w-2 rounded-full bg-green-400"}></div>
      <div className="text-xs text-slate-600">{height ?? "-"}</div>
    </div>
  );
}
