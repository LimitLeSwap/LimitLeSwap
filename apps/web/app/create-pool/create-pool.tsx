"use client";
import { Card } from "@/components/ui/card";
import { CustomInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Waves, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWalletStore } from "@/lib/stores/wallet";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { usePoolStore } from "@/lib/stores/poolStore";
import { useClientStore } from "@/lib/stores/client";
import { Balance, TokenId, UInt64 } from "@proto-kit/library";
import { PublicKey } from "o1js";
import { DECIMALS } from "@/lib/constants";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PendingTransaction } from "@proto-kit/sequencer";
import { tokens } from "@/lib/tokens";
import { findTokenAndPoolByName } from "@/lib/common";
import { useHasMounted } from "@/lib/customHooks";

export default function CreatePool() {
  const walletStore = useWalletStore();
  const wallet = walletStore.wallet;
  const hasMounted = useHasMounted();
  const [waitApproval, setWaitApproval] = useState(false);
  const [state, setState] = useState({
    tokenAmountA: "",
    tokenAmountB: "",
    tokenA: "MINA",
    tokenB: "USDT",
    feeTier: 2,
    poolExist: false,
  });
  const { toast } = useToast();
  const poolStore = usePoolStore();
  const client = useClientStore();

  const [tokenAObj, tokenBObj, pool] = useMemo(() => {
    return findTokenAndPoolByName(state.tokenA, state.tokenB, poolStore);
  }, [state.tokenA, state.tokenB, poolStore.poolList, poolStore.tokenList]);

  useEffect(() => {
    if (pool) {
      console.log("Pool exists", pool);
      setState((prev) => ({
        ...prev,
        poolExist: true,
      }));
    } else {
      setState((prev) => ({
        ...prev,
        poolExist: false,
      }));
    }
  }, [pool, hasMounted, poolStore.poolList]);

  const handleSubmit = async () => {
    console.log(state);
    setWaitApproval(true);

    if (tokenAObj?.name === tokenBObj?.name) {
      toast({
        title: "Invalid token selection",
        description: "Please select different tokens to create pool",
      });
      setWaitApproval(false);
      return;
    }

    if (pool) {
      toast({
        title: "Pool already exists",
        description: "Please select a valid pool to create",
      });
      setWaitApproval(false);
      return;
    }

    const tokenAmountA = Number(state.tokenAmountA);
    const tokenAmountB = Number(state.tokenAmountB);

    if (tokenAmountA <= 0 || tokenAmountB <= 0) {
      toast({
        title: "Invalid token amount",
        description: "Please enter a valid token amount",
      });
      setWaitApproval(false);
      return;
    }

    console.log("Creating pool");

    try {
      if (client.client && wallet && tokenAObj && tokenBObj) {
        const TokenIdA = TokenId.from(tokenAObj.tokenId);
        const TokenIdB = TokenId.from(tokenBObj.tokenId);
        const TokenAmountA = Balance.from(
          BigInt(tokenAmountA * Number(DECIMALS)),
        );
        const TokenAmountB = Balance.from(
          BigInt(tokenAmountB * Number(DECIMALS)),
        );
        const lpRequested = Balance.from(
          BigInt(
            Math.floor(
              Math.sqrt(tokenAmountA * tokenAmountB) * Number(DECIMALS) - 1000,
            ),
          ),
        );

        console.log(lpRequested.mul(lpRequested).toString());
        console.log(TokenAmountA.mul(TokenAmountB).toString());

        const poolModule = client.client.runtime.resolve("PoolModule");

        const tx = await client.client.transaction(
          PublicKey.fromBase58(wallet),
          async () => {
            await poolModule.createPool(
              TokenIdA,
              TokenIdB,
              TokenAmountA,
              TokenAmountB,
              PublicKey.fromBase58(wallet),
              UInt64.from(state.feeTier),
              lpRequested,
            );
          },
        );

        await tx.sign();
        await tx.send();

        if (tx.transaction instanceof PendingTransaction)
          walletStore.addPendingTransaction(tx.transaction);
        else {
          toast({
            title: "Transaction failed",
            description: "Please try again",
          });
        }
      }
    } catch (e) {
      toast({
        title: "Transaction failed",
        description: "Please try again",
      });
      console.error(e);
    }

    setWaitApproval(false);
  };

  const handleTokenAChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^[0-9]*\.?[0-9]*$/.test(value)) {
      setState((prev) => ({
        ...prev,
        tokenAmountA: value,
      }));
    }
  };

  const handleTokenBChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^[0-9]*\.?[0-9]*$/.test(value)) {
      setState((prev) => ({
        ...prev,
        tokenAmountB: value,
      }));
    }
  };
  return (
    <div className="flex h-full w-full items-start justify-center p-2 sm:p-4 md:p-8 xl:pt-16">
      <div className="flex w-full max-w-[470px] sm:w-[470px]">
        <Card className="flex w-full flex-col items-center border-0 shadow-none">
          <div className="mb-2 flex flex-row items-center justify-center gap-2">
            <h2 className="text-2xl font-bold">Create Pool</h2>
            <Waves className="h-6 w-6" />
          </div>

          <div className="flex flex-row items-center rounded-2xl border p-4">
            <CustomInput
              value={state.tokenAmountA}
              onChange={handleTokenAChange}
              placeholder={"0"}
              pattern="^[0-9]*[.,]?[0-9]*$"
              minLength={1}
              maxLength={40}
              inputMode="decimal"
              className="py-2"
            />

            <Select
              value={state.tokenA}
              onValueChange={(value) => {
                setState({ ...state, tokenA: value });
              }}
            >
              <SelectTrigger className=" w-60 rounded-2xl">
                <SelectValue placeholder="Select a token to swap" />
              </SelectTrigger>

              <SelectContent className=" items-center  rounded-2xl text-center">
                {tokens.map((token) => (
                  <SelectItem value={token.name} key={token.name}>
                    <div className=" flex w-full flex-row gap-4">
                      <img src={token.icon} className=" h-4 w-4" />
                      {token.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative my-1 w-10">
            <Button
              variant={"outline"}
              className=" absolute bottom-0 left-0 right-0 top-0 mx-auto my-auto cursor-default  border-0 ring-1 ring-border ring-offset-4 hover:bg-card"
              size={"icon"}
            >
              <Plus className="h-3 w-3 "></Plus>
            </Button>
          </div>

          <div className="flex flex-row items-center rounded-2xl border p-4">
            <CustomInput
              value={state.tokenAmountB}
              onChange={handleTokenBChange}
              placeholder={"0"}
              pattern="^[0-9]*[.,]?[0-9]*$"
              minLength={1}
              maxLength={40}
              inputMode="decimal"
              type="number"
            />

            <Select
              value={state.tokenB}
              onValueChange={(value) => {
                setState({ ...state, tokenB: value });
              }}
            >
              <SelectTrigger className=" w-60 rounded-2xl">
                <SelectValue placeholder="Select a token to swap" />
              </SelectTrigger>

              <SelectContent className=" items-center  rounded-2xl text-center">
                {tokens.map((token) => (
                  <SelectItem value={token.name} key={token.name}>
                    <div className=" flex w-full flex-row gap-4">
                      <img src={token.icon} className=" h-4 w-4" />
                      {token.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs
            value={state.feeTier.toString()}
            onValueChange={(value) => {
              setState({ ...state, feeTier: Number(value) });
            }}
            className="mt-6 w-full rounded-2xl"
          >
            <TabsList className="grid w-full grid-cols-4 rounded-2xl bg-gray-700">
              {[0.01, 0.05, 0.3, 1].map((fee, index) => (
                <TabsTrigger
                  key={index}
                  className="  rounded-2xl data-[state=active]:bg-background"
                  value={index.toString()}
                >
                  {fee}%
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Button
            size={"lg"}
            type="submit"
            className="mt-6 w-full rounded-2xl"
            disabled={waitApproval || state.poolExist}
            loading={waitApproval}
            onClick={() => {
              wallet ?? walletStore.connect();
              wallet && handleSubmit();
            }}
          >
            {wallet
              ? state.poolExist
                ? "Pool exists"
                : waitApproval
                  ? "Waiting Approval"
                  : "Create Pool"
              : "Connect wallet"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
