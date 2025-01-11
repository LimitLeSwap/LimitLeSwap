"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CustomInput } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { calculateLpAddLiquidity, findTokenAndPoolByName } from "@/lib/common";
import { DECIMALS } from "@/lib/constants";
import { useHasMounted } from "@/lib/customHooks";
import { useClientStore } from "@/lib/stores/client";
import { usePoolStore } from "@/lib/stores/poolStore";
import { useWalletStore } from "@/lib/stores/wallet";
import { tokens } from "@/lib/tokens";
import { Balance, TokenId } from "@proto-kit/library";
import { PendingTransaction } from "@proto-kit/sequencer";
import { ArrowDown, ArrowRight, Droplets, Plus } from "lucide-react";
import { PublicKey } from "o1js";
import React, { useEffect, useMemo, useState } from "react";

export default function AddLiq() {
  const walletStore = useWalletStore();
  const hasMounted = useHasMounted();
  const poolStore = usePoolStore();
  const client = useClientStore();
  const { toast } = useToast();

  const wallet = walletStore.wallet;

  const [position, setPosition] = useState<Position | null>(null);

  const [leadingInput, setLeadingInput] = useState<"A" | "B" | null>(null);

  const [state, setState] = useState({
    tokenAmountA: "",
    tokenAmountB: "",
    tokenA: "MINA",
    tokenB: "USDT",
    lpRequested: 0,
  });

  const [tokenAObj, tokenBObj, pool] = useMemo(() => {
    return findTokenAndPoolByName(state.tokenA, state.tokenB, poolStore);
  }, [state.tokenA, state.tokenB, poolStore.poolList, poolStore.tokenList]);

  useEffect(() => {
    if (pool) {
      const pos = poolStore.positionList.find((pos) => {
        return pos.poolId.toString() === pool.poolId.toString();
      });
      setPosition(pos ?? null);
    }
  }, [pool, hasMounted, poolStore.poolList, poolStore.positionList]);

  const calculateQuoteFromA = (
    tokenAAmount: number,
    tokenAReserve: number,
    tokenBReserve: number,
    lpSupply: number,
  ) => {
    const tokenBAmount =
      tokenAReserve > 0
        ? Math.floor(
            (tokenBReserve * tokenAAmount * Number(DECIMALS)) / tokenAReserve,
          ) / Number(DECIMALS)
        : 0;

    const lpRequested = calculateLpAddLiquidity(
      tokenAAmount * Number(DECIMALS),
      tokenBAmount * Number(DECIMALS),
      tokenAReserve,
      tokenBReserve,
      lpSupply,
    );

    return { tokenBAmount, lpRequested };
  };

  const calculateQuoteFromB = (
    tokenBAmount: number,
    tokenAReserve: number,
    tokenBReserve: number,
    lpSupply: number,
  ) => {
    const tokenAAmount =
      tokenBReserve > 0
        ? Math.floor(
            (tokenAReserve * tokenBAmount * Number(DECIMALS)) / tokenBReserve,
          ) / Number(DECIMALS)
        : 0;

    const lpRequested = calculateLpAddLiquidity(
      tokenAAmount * Number(DECIMALS),
      tokenBAmount * Number(DECIMALS),
      tokenAReserve,
      tokenBReserve,
      lpSupply,
    );

    return { tokenAAmount, lpRequested };
  };

  useEffect(() => {
    if (!pool) return;

    const tokenAReserve =
      pool.token0.name === state.tokenA
        ? Number(pool.token0Amount)
        : Number(pool.token1Amount);
    const tokenBReserve =
      pool.token0.name === state.tokenA
        ? Number(pool.token1Amount)
        : Number(pool.token0Amount);

    const lpSupply = Number(pool.lpTokenSupply) || 0;

    const userA = parseFloat(state.tokenAmountA) || 0;
    const userB = parseFloat(state.tokenAmountB) || 0;

    if (leadingInput === "A") {
      const { tokenBAmount, lpRequested } = calculateQuoteFromA(
        userA,
        tokenAReserve,
        tokenBReserve,
        lpSupply,
      );
      setState((prev) => ({
        ...prev,
        tokenAmountB: tokenBAmount.toString(),
        lpRequested,
      }));
    } else if (leadingInput === "B") {
      const { tokenAAmount, lpRequested } = calculateQuoteFromB(
        userB,
        tokenAReserve,
        tokenBReserve,
        lpSupply,
      );
      setState((prev) => ({
        ...prev,
        tokenAmountA: tokenAAmount.toString(),
        lpRequested,
      }));
    }
  }, [
    pool,
    position,
    leadingInput,
    state.tokenAmountA,
    state.tokenAmountB,
    state.tokenA,
    state.tokenB,
  ]);

  const handleSubmit = async () => {
    let tokenAId = poolStore.tokenList.find(
      (token) => token.name === state.tokenA,
    );
    let tokenBId = poolStore.tokenList.find(
      (token) => token.name === state.tokenB,
    );

    if (
      client.client &&
      wallet &&
      pool &&
      state.lpRequested > 0 &&
      tokenAId &&
      tokenBId
    ) {
      const poolModule = client.client.runtime.resolve("PoolModule");

      const tokenA = TokenId.from(tokenAId.tokenId);
      const tokenB = TokenId.from(tokenBId.tokenId);
      const tokenAmountA = Balance.from(
        BigInt(Number(state.tokenAmountA) * Number(DECIMALS)),
      );
      const tokenAmountB = Balance.from(
        BigInt(Number(state.tokenAmountB) * Number(DECIMALS)),
      );
      const lpAmount = Balance.from(BigInt(Math.floor(state.lpRequested)));

      try {
        const tx = await client.client.transaction(
          PublicKey.fromBase58(wallet),
          async () => {
            await poolModule.addLiquidity(
              tokenA,
              tokenB,
              tokenAmountA,
              tokenAmountB,
              lpAmount,
            );
          },
        );

        await tx.sign();
        await tx.send();

        if (tx.transaction instanceof PendingTransaction) {
          walletStore.addPendingTransaction(tx.transaction);
        } else {
          toast({
            title: "Transaction failed",
            description: "Please try again",
          });
        }
      } catch (err) {
        toast({
          title: "Transaction Error",
          description: String(err),
        });
      }
    }
  };

  const handleTokenAChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^[0-9]*\.?[0-9]*$/.test(value)) {
      setLeadingInput("A");
      setState((prev) => ({
        ...prev,
        tokenAmountA: value,
      }));
    }
  };

  const handleTokenBChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^[0-9]*\.?[0-9]*$/.test(value)) {
      setLeadingInput("B");
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
            <h2 className="text-2xl font-bold">Add Liquidity</h2>
            <Droplets className="h-6 w-6" />
          </div>

          <div className="flex flex-row items-center rounded-2xl border p-4">
            <CustomInput
              value={state.tokenAmountA}
              onChange={handleTokenAChange}
              placeholder="0"
              pattern="^[0-9]*[.,]?[0-9]*$"
              minLength={1}
              maxLength={40}
              inputMode="decimal"
            />
            <Select
              value={state.tokenA}
              onValueChange={(value) => {
                setLeadingInput(null);
                setState((prev) => ({
                  ...prev,
                  tokenA: value,
                  tokenAmountA: "",
                  tokenAmountB: "",
                  lpRequested: 0,
                }));
              }}
            >
              <SelectTrigger className="w-60 rounded-2xl">
                <SelectValue placeholder="Select a token" />
              </SelectTrigger>
              <SelectContent className="items-center rounded-2xl text-center">
                {tokens.map((token) => (
                  <SelectItem key={token.name} value={token.name}>
                    <div className="flex w-full flex-row gap-4">
                      <img src={token.icon} className="h-4 w-4" />
                      {token.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative my-1 w-10">
            <Button
              variant="outline"
              className="absolute bottom-0 left-0 right-0 top-0 mx-auto my-auto cursor-default border-0 ring-1 ring-border ring-offset-4 hover:bg-card"
              size="icon"
            >
              <Plus className="h-3 w-3 " />
            </Button>
          </div>

          <div className="flex flex-row items-center rounded-2xl border p-4">
            <CustomInput
              value={state.tokenAmountB}
              onChange={handleTokenBChange}
              placeholder="0"
              pattern="^[0-9]*[.,]?[0-9]*$"
              minLength={1}
              maxLength={40}
              inputMode="decimal"
            />
            <Select
              value={state.tokenB}
              onValueChange={(value) => {
                setLeadingInput(null);
                setState((prev) => ({
                  ...prev,
                  tokenB: value,
                  tokenAmountA: "",
                  tokenAmountB: "",
                  lpRequested: 0,
                }));
              }}
            >
              <SelectTrigger className="w-60 rounded-2xl">
                <SelectValue placeholder="Select a token" />
              </SelectTrigger>
              <SelectContent className="items-center rounded-2xl text-center">
                {tokens.map((token) => (
                  <SelectItem key={token.name} value={token.name}>
                    <div className="flex w-full flex-row gap-4">
                      <img src={token.icon} className="h-4 w-4" />
                      {token.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="my-1 flex w-10 items-center justify-center">
            <ArrowDown className="h-6 w-6" />
          </div>

          <div className="mt-2 flex w-full flex-col items-center gap-4 rounded-2xl border p-4">
            <h3 className="py-2 text-sm">Current Prices and Your Pool Share</h3>
            <div className="grid w-full grid-cols-3">
              <div className="col-span-1 flex flex-col items-center">
                <p>
                  {pool && Number(pool.lpTokenSupply) > 0
                    ? (
                        Number(pool.token0Amount) / Number(pool.token1Amount)
                      ).toFixed(2)
                    : 0}
                </p>
                <p className="text-custom-input text-sm">
                  {`${state.tokenA} / ${state.tokenB}`}
                </p>
              </div>

              <div className="col-span-1 flex flex-col items-center">
                <p>
                  {pool && Number(pool.lpTokenSupply) > 0
                    ? (
                        Number(pool.token1Amount) / Number(pool.token0Amount)
                      ).toFixed(2)
                    : 0}
                </p>
                <p className="text-custom-input text-sm">
                  {`${state.tokenB} / ${state.tokenA}`}
                </p>
              </div>

              <div className="col-span-1 flex flex-col items-center">
                {state.lpRequested > 0 && pool ? (
                  <div className="flex flex-row items-center gap-1">
                    <p className="text-xs text-muted line-through">
                      {`${
                        pool && position
                          ? (
                              (Number(position.lpTokenAmount) /
                                Number(pool.lpTokenSupply)) *
                              100
                            ).toFixed(1)
                          : 0
                      } %`}
                    </p>
                    <ArrowRight className="h-3 w-4" />
                    <p className="text-green-600">
                      {`${(
                        (((position ? Number(position.lpTokenAmount) : 0) +
                          state.lpRequested) /
                          (Number(pool.lpTokenSupply) + state.lpRequested)) *
                        100
                      ).toFixed(1)} %`}
                    </p>
                  </div>
                ) : (
                  <p>
                    {`${
                      pool && position
                        ? (
                            (Number(position.lpTokenAmount) /
                              Number(pool.lpTokenSupply)) *
                            100
                          ).toFixed(1)
                        : 0
                    } %`}
                  </p>
                )}
                <p className="text-custom-input text-sm">Share of pool</p>
              </div>
            </div>
          </div>

          <Button
            size="lg"
            type="submit"
            className="mt-6 w-full rounded-2xl"
            disabled={!pool}
            onClick={() => {
              wallet ?? walletStore.connect();
              wallet && handleSubmit();
            }}
          >
            {wallet
              ? pool
                ? "Add Liquidity"
                : "Pool Not Found"
              : "Connect wallet"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
