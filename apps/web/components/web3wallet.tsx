import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useWalletStore } from "@/lib/stores/wallet";
// @ts-ignore
import truncateMiddle from "truncate-middle";
import React, { useState } from "react";
import { Drawer, DrawerContent } from "./ui/drawer";
import { DECIMALS } from "@/lib/constants";
import { BalancesState } from "@/lib/stores/balances";
import { usePoolStore } from "@/lib/stores/poolStore";
import { Sheet, SheetContent } from "./ui/sheet";

interface Web3walletProps {
  loading: boolean;
  isMobile: boolean;
  balances: BalancesState;
}
export default function Web3wallet({
  loading,
  isMobile,
  balances,
}: Web3walletProps) {
  const [open, setOpen] = useState(false);
  const walletStore = useWalletStore();
  const poolStore = usePoolStore();
  const { toast } = useToast();

  const handleConnectWallet = async () => {
    if (walletStore.isConnected) {
      setOpen(true);
    } else {
      const res = await walletStore.connect();
      if (res === 0) {
        toast({
          title: "Auro wallet not found",
          description: "Please install Auro wallet",
        });
        return;
      }
      if (res === 2) {
        toast({
          title: "Error",
          description: "Failed to connect wallet",
        });
        return;
      }
    }
  };

  return (
    <>
      {/* Mobile */}
      <div className="flex flex-row items-center self-end sm:hidden">
        <Button
          loading={loading}
          className="w-24 rounded-2xl"
          onClick={handleConnectWallet}
        >
          <div className="text-xs">
            {walletStore.wallet
              ? truncateMiddle(walletStore.wallet, 4, 4, "...")
              : "Connect wallet"}
          </div>
        </Button>
        {walletStore.wallet && (
          <Drawer open={open && isMobile} onOpenChange={setOpen}>
            <DrawerContent>
              {poolStore.tokenList.map((token) => {
                return (
                  <div
                    key={token.name}
                    className="flex flex-row justify-end text-right text-sm font-bold"
                  >
                    {(
                      BigInt(balances.balances[token.name] ?? 0) / DECIMALS
                    ).toString()}{" "}
                    {token.name}
                  </div>
                );
              })}
            </DrawerContent>
          </Drawer>
        )}
      </div>

      {/* Desktop */}
      <div className="hidden sm:flex">
        <Button
          loading={loading}
          className="rounded-2xl sm:w-24 md:w-28 xl:w-32"
          onClick={handleConnectWallet}
        >
          <div className="sm:text-xs md:text-sm xl:text-base">
            {walletStore.wallet
              ? truncateMiddle(walletStore.wallet, 4, 4, "...")
              : "Connect wallet"}
          </div>
        </Button>
        {walletStore.wallet && (
          <Sheet open={open && !isMobile} onOpenChange={setOpen}>
            <SheetContent className="flex w-80 flex-col gap-4 rounded-2xl p-4 px-6">
              {poolStore.tokenList.map((token) => {
                return (
                  <div
                    key={token.name}
                    className="flex flex-row justify-end text-right text-sm font-bold"
                  >
                    {(
                      BigInt(balances.balances[token.name] ?? 0) / DECIMALS
                    ).toString()}{" "}
                    {token.name}
                  </div>
                );
              })}
            </SheetContent>
          </Sheet>
        )}
      </div>
    </>
  );
}
