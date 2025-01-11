"use client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useWalletStore } from "@/lib/stores/wallet";
import { useBalancesStore } from "@/lib/stores/balances";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { usePoolStore } from "@/lib/stores/poolStore";
import { Fuel } from "lucide-react";
import { useClientStore } from "@/lib/stores/client";
import { TokenId } from "@proto-kit/library";
import { useToast } from "@/components/ui/use-toast";
import { tokens } from "@/lib/tokens";

export default function Faucet() {
  const walletStore = useWalletStore();
  const wallet = walletStore.wallet;
  const [token, setToken] = useState("MINA");
  const [loading, setLoading] = useState(true);
  const poolStore = usePoolStore();
  const balances = useBalancesStore();
  const client = useClientStore();
  const { toast } = useToast();

  useEffect(() => {
    if (poolStore.tokenList.length > 0) {
      const tokenId = poolStore.tokenList.find(
        (_token) => _token.name === token,
      )?.tokenId;
      console.log(tokenId);
      balances.setFaucetTokenId(tokenId ?? "0");
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [token, poolStore.tokenList]);

  const drip = async () => {
    if (!client.client || !wallet) return;
    setLoading(true);
    try {
      const pendingTransaction = await balances.faucet(
        client.client,
        wallet,
        TokenId.from(balances.faucetTokenId),
      );
      walletStore.addPendingTransaction(pendingTransaction);
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to drip tokens",
      });
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="flex h-full w-full items-start justify-center p-2 sm:p-4 md:p-8 xl:pt-16">
      <div className="flex w-full max-w-[470px] flex-col sm:w-[470px]">
        <div className="mb-2 flex flex-row items-center justify-center gap-2">
          <h2 className="text-xl font-bold">Token Faucet</h2>
          <Fuel className="h-4 w-4" />
        </div>
        <Card className="w-full rounded-2xl p-4">
          <div className="mb-2">
            <p className="mt-1 text-sm text-zinc-500">
              Get testing (L2) tokens for your wallet
            </p>
          </div>

          <div className="pt-3">
            <Label>
              To <span className="text-sm text-zinc-500">(your wallet)</span>
            </Label>

            <Input
              className="w-full rounded-2xl"
              disabled
              placeholder={wallet ?? "Please connect a wallet first"}
            />
          </div>

          <div className="mt-6 flex flex-row items-center justify-center gap-4">
            <Select
              value={token}
              onValueChange={(value) => {
                setToken(value);
              }}
            >
              <SelectTrigger className=" w-60 rounded-2xl">
                {/* <img src={`/${token}.png`} className=" h-4 w-4" /> */}
                <SelectValue placeholder="Select a token to drip" />
              </SelectTrigger>

              <SelectContent className=" items-center  rounded-2xl text-center">
                {tokens.map((token) => (
                  <SelectItem value={token.name}>
                    <div className=" flex w-full flex-row gap-4">
                      <img src={token.icon} className=" h-4 w-4" />
                      {token.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size={"lg"}
              type="submit"
              className=" w-full rounded-2xl"
              disabled={loading}
              loading={loading && (wallet ? false : true)}
              onClick={() => {
                wallet ?? walletStore.connect();
                wallet && drip();
              }}
            >
              {wallet ? "Drip 💦" : "Connect wallet"}
            </Button>
          </div>

          <div className=" flex w-full flex-row items-center justify-center">
            <p className="pt-4 text-sm text-zinc-500">
              For L1 Mina tokens, please use the{" "}
              <a
                href="https://faucet.minaprotocol.com/"
                target="_blank"
                className="inline text-sm  underline"
              >
                Mina Faucet
              </a>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
