import Header from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { useBalancesStore, useObserveBalance } from "@/lib/stores/balances";
import { useChainStore, usePollBlockHeight } from "@/lib/stores/chain";
import { useClientStore } from "@/lib/stores/client";
import { useObserveOrders } from "@/lib/stores/limitStore";
import { useNotifyTransactions, useWalletStore } from "@/lib/stores/wallet";
import { ReactNode, useEffect, useMemo, useState } from "react";

export default function AsyncLayout({ children }: { children: ReactNode }) {
  const wallet = useWalletStore();
  const client = useClientStore();
  const chain = useChainStore();
  const balances = useBalancesStore();
  const [isMobile, setIsMobile] = useState(false);

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

  const loading = useMemo(
    () => client.loading || balances.loading,
    [client.loading, balances.loading],
  );

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    console.log("isMobile", isMobile);
    setIsMobile(isMobile);
  }, []);

  return (
    <>
      <ThemeProvider attribute="class" defaultTheme="light">
        <Header
          loading={client.loading}
          isMobile={isMobile}
          blockHeight={chain.block?.height ?? "-"}
        />
        {children}
        <Toaster />
      </ThemeProvider>
    </>
  );
}
