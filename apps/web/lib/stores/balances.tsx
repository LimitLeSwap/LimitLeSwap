import { create } from "zustand";
import { Client, useClientStore } from "./client";
import { immer } from "zustand/middleware/immer";
import { PendingTransaction, UnsignedTransaction } from "@proto-kit/sequencer";
import { Balance, BalancesKey, TokenId } from "@proto-kit/library";
import { PublicKey } from "o1js";
import { useEffect, useRef } from "react";
import { useChainStore } from "./chain";
import { useWalletStore } from "./wallet";
import { usePoolStore } from "./poolStore";
import { DECIMALS } from "../constants";
import isEqual from "lodash.isequal";

export interface BalancesState {
  loading: boolean;
  balances: {
    [key: string]: string;
  };
  faucetTokenId: string;
  setFaucetTokenId: (tokenId: string) => void;
  setBalances: (balances: { [key: string]: string }) => void;
  faucet: (
    client: Client,
    address: string,
    token: TokenId,
  ) => Promise<PendingTransaction>;
}

function isPendingTransaction(
  transaction: PendingTransaction | UnsignedTransaction | undefined,
): asserts transaction is PendingTransaction {
  if (!(transaction instanceof PendingTransaction))
    throw new Error("Transaction is not a PendingTransaction");
}

export interface GetAddressBalancesResponse {
  data: {
    balances: [
      {
        amount: number;
        tokenId: string;
      },
    ];
  };
}

export const useBalancesStore = create<
  BalancesState,
  [["zustand/immer", never]]
>(
  immer((set) => ({
    loading: Boolean(false),
    balances: {},
    faucetTokenId: "0",
    setFaucetTokenId: (tokenId: string) => set({ faucetTokenId: tokenId }),

    setBalances: (balances) =>
      set((state) => {
        state.balances = balances;
      }),

    async faucet(client: Client, address: string) {
      const balances = client.runtime.resolve("Balances");
      const sender = PublicKey.fromBase58(address);

      const tx = await client.transaction(sender, async () => {
        const amount = BigInt(1000) * DECIMALS;
        await balances.mintToken(
          TokenId.from(this.faucetTokenId),
          sender,
          Balance.from(amount.toString()),
        );
      });

      await tx.sign();
      await tx.send();
      console.log("Hash", tx.transaction?.hash().toString());

      isPendingTransaction(tx.transaction);
      return tx.transaction;
    },
  })),
);

export const useObserveBalance = () => {
  const chain = useChainStore();
  const wallet = useWalletStore();
  const balances = useBalancesStore();
  const poolStore = usePoolStore();

  const previousBalancesRef = useRef<{ [key: string]: string }>({});

  useEffect(() => {
    if (!wallet.wallet) return;

    (async () => {
      const graphql = process.env.NEXT_PUBLIC_PROTOKIT_PROCESSOR_GRAPHQL_URL;

      if (graphql === undefined) {
        throw new Error(
          "Environment variable NEXT_PUBLIC_PROTOKIT_PROCESSOR_GRAPHQL_URL not set, can't execute graphql requests",
        );
      }

      const balancesResponse = await fetch(graphql, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `query GetAddressBalances {
  balances(
    where: {address: {equals: "${wallet.wallet}"}}
    take: ${poolStore.tokenList.length - 1}
    distinct: tokenId
    orderBy: {height: desc}
  ) {
    amount
    tokenId
  }
}`,
        }),
      });

      const { data } =
        (await balancesResponse.json()) as GetAddressBalancesResponse;

      if (data && data.balances) {
        const newBalances: { [key: string]: string } = {};
        for (const balance of data.balances) {
          const token = poolStore.tokenList.find(
            (token) => token.tokenId === balance.tokenId,
          );
          if (!token) continue;
          newBalances[token?.name] = balance.amount.toString();
        }

        if (!isEqual(newBalances, previousBalancesRef.current)) {
          console.log("Setting balances", newBalances);
          balances.setBalances(newBalances);
          previousBalancesRef.current = newBalances;
        }
      }
    })();
  }, [chain.block?.height, wallet.wallet, poolStore.tokenList]);
};
