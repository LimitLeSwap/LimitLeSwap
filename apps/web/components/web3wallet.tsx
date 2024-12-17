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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { Avatar } from "./ui/avatar";
import Jazzicon from "react-jazzicon";
import base58Decode from "@/lib/base56Decoder";
import Unlink from "./icons/unlink";

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
          className="sm:w-26 md:w-30 xl:w-34 rounded-2xl"
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
              <SheetHeader>
                <SheetTitle className=" flex w-52  flex-col items-start text-base font-bold">
                  <div className=" flex w-full flex-row items-center justify-start">
                    <Avatar>
                      <Jazzicon
                        diameter={30}
                        seed={base58Decode(walletStore.wallet)}
                      />
                    </Avatar>
                    {truncateMiddle(walletStore.wallet, 4, 4, "...")}
                  </div>
                  <Button
                    className="flex  rounded-2xl border-0"
                    variant={"outline"}
                    onClick={() => {
                      setOpen(false);
                      walletStore.disconnect();
                    }}
                  >
                    <Unlink className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                </SheetTitle>
              </SheetHeader>
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
