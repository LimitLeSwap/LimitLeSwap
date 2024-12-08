import { useToast } from "@/components/ui/use-toast";
import { PendingTransaction, UnsignedTransaction } from "@proto-kit/sequencer";
import { MethodIdResolver } from "@proto-kit/module";
import { useCallback, useEffect, useMemo } from "react";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
// @ts-ignore
import truncateMiddle from "truncate-middle";
import { usePrevious } from "@uidotdev/usehooks";
import { useClientStore } from "./client";
import { useChainStore } from "./chain";
import { Field, PublicKey, Signature, UInt64 } from "o1js";

export interface WalletState {
  isConnected: boolean;
  walletInstalled: boolean;
  wallet?: string;
  network?: string;

  setWalletInstalled: (
    walletInstalled: boolean,
    wallet?: string,
    network?: string,
  ) => void;
  observeWalletChange: () => void;
  connect: () => Promise<number>;
  disconnect: () => void;

  pendingTransactions: PendingTransaction[];
  addPendingTransaction: (pendingTransaction: PendingTransaction) => void;
  removePendingTransaction: (pendingTransaction: PendingTransaction) => void;
}

export const useWalletStore = create<WalletState, [["zustand/immer", never]]>(
  immer((set) => ({
    isConnected: false,
    walletInstalled: false,
    wallet: undefined,
    network: undefined,

    setWalletInstalled: (
      walletInstalled: boolean,
      wallet?: string,
      network?: string,
    ) =>
      set({
        walletInstalled,
        wallet,
        network,
      }),
    observeWalletChange() {
      if (typeof window === "undefined" || typeof window.mina === "undefined") {
        return;
      }

      window.mina.on("accountsChanged", ([wallet]) => {
        set((state) => {
          state.wallet = wallet;
          state.isConnected = !!wallet;
        });
      });
    },

    async connect() {
      if (window.mina === undefined) {
        console.error("Mina wallet not installed");
        return 0;
      }

      try {
        const wallet = await window.mina.requestAccounts();
        await window.mina?.switchChain({ networkID: "mina:testnet" });
        if (wallet[0]) {
          set((state) => {
            state.isConnected = true;
            state.walletInstalled = true;
            state.wallet = wallet[0];
          });
          return 1;
        }
      } catch (e) {
        console.error(e);
        return 2;
      }

      return 2;
    },

    disconnect: () =>
      set({
        isConnected: false,
        wallet: undefined,
      }),

    pendingTransactions: [] as PendingTransaction[],
    addPendingTransaction(pendingTransaction) {
      set((state) => {
        // @ts-expect-error
        state.pendingTransactions.push(pendingTransaction);
      });
    },
    removePendingTransaction(pendingTransaction) {
      set((state) => {
        state.pendingTransactions = state.pendingTransactions.filter((tx) => {
          return tx.hash().toString() !== pendingTransaction.hash().toString();
        });
      });
    },
  })),
);

export const useNotifyTransactions = () => {
  const wallet = useWalletStore();
  const chain = useChainStore();
  const { toast } = useToast();
  const client = useClientStore();

  const previousPendingTransactions = usePrevious(wallet.pendingTransactions);
  const newPendingTransactions = useMemo(() => {
    return wallet.pendingTransactions.filter(
      (pendingTransaction) =>
        !(previousPendingTransactions ?? []).includes(pendingTransaction),
    );
  }, [wallet.pendingTransactions, previousPendingTransactions]);

  const notifyTransaction = useCallback(
    (
      status: "PENDING" | "SUCCESS" | "FAILURE",
      transaction: UnsignedTransaction | PendingTransaction,
    ) => {
      if (!client.client) return;

      const methodIdResolver = client.client.resolveOrFail(
        "MethodIdResolver",
        MethodIdResolver,
      );

      const resolvedMethodDetails = methodIdResolver.getMethodNameFromId(
        transaction.methodId.toBigInt(),
      );

      if (!resolvedMethodDetails)
        throw new Error("Unable to resolve method details");

      const [moduleName, methodName] = resolvedMethodDetails;

      const hash = truncateMiddle(transaction.hash().toString(), 15, 15, "...");

      function title() {
        switch (status) {
          case "PENDING":
            return `⏳ Transaction sent: ${moduleName}.${methodName}`;
          case "SUCCESS":
            return `✅ Transaction successful: ${moduleName}.${methodName}`;
          case "FAILURE":
            return `❌ Transaction failed: ${moduleName}.${methodName}`;
        }
      }

      toast({
        title: title(),
        description: `Hash: ${hash}`,
      });
    },
    [client.client],
  );

  // notify about new pending transactions
  useEffect(() => {
    newPendingTransactions.forEach((pendingTransaction) => {
      notifyTransaction("PENDING", pendingTransaction);
    });
  }, [newPendingTransactions, notifyTransaction]);

  // notify about transaction success or failure
  useEffect(() => {
    const confirmedTransactions = chain.block?.txs?.map(
      ({ tx, status, statusMessage }) => {
        return {
          tx: new PendingTransaction({
            methodId: Field(tx.methodId),
            nonce: UInt64.from(tx.nonce),
            isMessage: false,
            sender: PublicKey.fromBase58(tx.sender),
            argsFields: tx.argsFields.map((arg) => Field(arg)),
            auxiliaryData: [],
            signature: Signature.fromJSON({
              r: tx.signature.r,
              s: tx.signature.s,
            }),
          }),
          status,
          statusMessage,
        };
      },
    );

    const confirmedPendingTransactions = confirmedTransactions?.filter(
      ({ tx }) => {
        return wallet.pendingTransactions?.find((pendingTransaction) => {
          return pendingTransaction.hash().toString() === tx.hash().toString();
        });
      },
    );

    confirmedPendingTransactions?.forEach(({ tx, status }) => {
      wallet.removePendingTransaction(tx);
      notifyTransaction(status ? "SUCCESS" : "FAILURE", tx);
    });
  }, [
    chain.block,
    wallet.pendingTransactions,
    client.client,
    notifyTransaction,
  ]);
};
