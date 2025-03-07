import Header from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { useAppStore } from "@/lib/stores/appStore";
import { useObserveBalance } from "@/lib/stores/balances";
import { useChainStore, usePollBlockHeight } from "@/lib/stores/chain";
import { useClientStore } from "@/lib/stores/client";
import { useObserveOrders } from "@/lib/stores/limitStore";
import { useNotifyTransactions, useWalletStore } from "@/lib/stores/wallet";
import { ReactNode, useEffect, useState } from "react";

export default function AsyncLayout({ children }: { children: ReactNode }) {
  const wallet = useWalletStore();
  const client = useClientStore();
  const chain = useChainStore();
  const appStore = useAppStore();

  usePollBlockHeight();
  useObserveBalance();
  useNotifyTransactions();
  useObserveOrders();

  useEffect(() => {
    client.start();
  }, []);

  useEffect(() => {
    wallet.observeWalletChange();
  }, []);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    console.log("isMobile", isMobile);
    appStore.setMobile(isMobile);
  }, []);

  return (
    <>
      <ThemeProvider attribute="class" defaultTheme="light">
        <Header
          loading={client.loading}
          blockHeight={chain.block?.height ?? "-"}
        />
        {children}
        <Toaster />
      </ThemeProvider>
    </>
  );
}
