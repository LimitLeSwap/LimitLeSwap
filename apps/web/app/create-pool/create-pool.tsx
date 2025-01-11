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
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { usePoolStore } from "@/lib/stores/poolStore";
import { useClientStore } from "@/lib/stores/client";
import { Balance, TokenId, UInt64 } from "@proto-kit/library";
import { PublicKey } from "o1js";
import { DECIMALS } from "@/lib/constants";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PendingTransaction } from "@proto-kit/sequencer";
import { tokens } from "@/lib/tokens";

export default function CreatePool() {
  const walletStore = useWalletStore();
  const wallet = walletStore.wallet;
  const [state, setState] = useState({
    tokenAmountA: 0,
    tokenAmountB: 0,
    tokenA: "MINA",
    tokenB: "USDT",
    feeTier: 2,
  });
  const { toast } = useToast();
  const poolStore = usePoolStore();
  const client = useClientStore();

  const handleSubmit = async () => {
    console.log(state);

    let tokenA = poolStore.tokenList.find(
      (token) => token.name === state.tokenA,
    );
    let tokenB = poolStore.tokenList.find(
      (token) => token.name === state.tokenB,
    );

    if (tokenA?.name === tokenB?.name) {
      toast({
        title: "Invalid token selection",
        description: "Please select different tokens to create pool",
      });
      return;
    }

    const pool = poolStore.poolList.find((pool) => {
      (pool.token0.name === tokenA?.name &&
        pool.token1.name === tokenB?.name) ||
        (pool.token0.name === tokenB?.name &&
          pool.token1.name === tokenA?.name);
    });

    if (pool) {
      toast({
        title: "Pool already exists",
        description: "Please select a valid pool to create",
      });
      return;
    }

    const tokenAmountA = state.tokenAmountA;
    const tokenAmountB = state.tokenAmountB;

    if (tokenAmountA <= 0 || tokenAmountB <= 0) {
      toast({
        title: "Invalid token amount",
        description: "Please enter a valid token amount",
      });
      return;
    }

    console.log("Creating pool");

    if (client.client && wallet && tokenA && tokenB) {
      const TokenIdA = TokenId.from(tokenA.tokenId);
      const TokenIdB = TokenId.from(tokenB.tokenId);
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
              onChange={(e) => {
                setState({ ...state, tokenAmountA: Number(e.target.value) });
              }}
              placeholder={"0"}
              pattern="^[0-9]*[.,]?[0-9]*$"
              minLength={1}
              maxLength={40}
              inputMode="decimal"
              className="py2"
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
              onChange={(e) => {
                setState({ ...state, tokenAmountB: Number(e.target.value) });
              }}
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
              {/* <TabsTrigger
                className="  rounded-2xl data-[state=active]:bg-background"
                value="0"
              >
                0.01%
              </TabsTrigger>
              <TabsTrigger
                className="  rounded-2xl data-[state=active]:bg-background"
                value="1"
              >
                0.05%
              </TabsTrigger>
              <TabsTrigger
                className="  rounded-2xl data-[state=active]:bg-background"
                value="2"
              >
                0.3%
              </TabsTrigger>
              <TabsTrigger
                className="  rounded-2xl data-[state=active]:bg-background"
                value="3"
              >
                1%
              </TabsTrigger> */}
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
            onClick={() => {
              wallet ?? walletStore.connect();
              wallet && handleSubmit();
            }}
          >
            {wallet ? "Create Pool" : "Connect wallet"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
