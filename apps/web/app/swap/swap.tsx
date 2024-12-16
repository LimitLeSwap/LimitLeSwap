"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CustomInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWalletStore } from "@/lib/stores/wallet";
import { ArrowUpDown, Route } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { usePoolStore } from "@/lib/stores/poolStore";
import { useHasMounted } from "@/lib/customHooks";
import { useClientStore } from "@/lib/stores/client";
import { Balance, TokenId } from "@proto-kit/library";
import { useToast } from "@/components/ui/use-toast";
import { Field, PublicKey } from "o1js";
import { DECIMALS } from "@/lib/constants";
import PoolRatio from "./poolRatio";
import {
  calculateSwap,
  calculateWithLimitOrders,
  findPool,
} from "./swapFunctions";
import { OrderBundle, useLimitStore } from "@/lib/stores/limitStore";
import { useChainStore } from "@/lib/stores/chain";
import { PendingTransaction } from "@proto-kit/sequencer";

export default function Swap() {
  const walletStore = useWalletStore();
  const limitStore = useLimitStore();
  const hasMounted = useHasMounted();
  const chainStore = useChainStore();
  const poolStore = usePoolStore();
  const client = useClientStore();
  const wallet = walletStore.wallet;

  const [state, setState] = useState({
    sellToken: "MINA",
    buyToken: "USDT",
    sellAmount: "",
    buyAmount: 0,
    priceImpact: "0",
  });

  const [seePoolDetails, setSeePoolDetails] = useState(false);
  const [newPool, setNewPool] = useState<Pool | null>(null);
  const [pool, setPool] = useState<Pool | null>(null);
  const [limitState, setlimitState] = useState<{
    execute: boolean;
    ordersToFill: null | any[];
    bestAmountOut: number;
    newPriceImpact: number;
  }>({
    execute: false,
    ordersToFill: [],
    bestAmountOut: 0,
    newPriceImpact: 0,
  });

  const { toast } = useToast();

  const [sellTokenObj, buyTokenObj, currentPool] = useMemo(() => {
    return findPool(state.sellToken, state.buyToken, poolStore);
  }, [
    state.sellToken,
    state.buyToken,
    poolStore.poolList,
    poolStore.tokenList,
  ]);

  useEffect(() => {
    setPool(currentPool);
  }, [currentPool]);

  useEffect(() => {
    if (!hasMounted || !currentPool || !sellTokenObj || !buyTokenObj) {
      return;
    }

    const sellAmountNum = parseFloat(state.sellAmount);
    if (isNaN(sellAmountNum) || sellAmountNum <= 0) {
      setState((prev) => ({
        ...prev,
        buyAmount: 0,
        priceImpact: "0",
      }));
      setNewPool(null);
      setlimitState({
        execute: false,
        ordersToFill: [],
        bestAmountOut: 0,
        newPriceImpact: 0,
      });
      return;
    }

    const sellAmount = sellAmountNum * Number(DECIMALS);

    const poolSellTokenReserve =
      currentPool.token0.name === sellTokenObj?.name
        ? Number(currentPool.token0Amount)
        : Number(currentPool.token1Amount);

    const poolBuyTokenReserve =
      currentPool.token0.name === buyTokenObj?.name
        ? Number(currentPool.token0Amount)
        : Number(currentPool.token1Amount);

    const { amountOut, price, priceImpact } = calculateSwap(
      poolBuyTokenReserve,
      poolSellTokenReserve,
      sellAmount,
    );

    console.table([amountOut, price, priceImpact]);

    const { ordersToFill, bestAmountOut, newPriceImpact } =
      calculateWithLimitOrders(
        buyTokenObj,
        sellTokenObj,
        amountOut,
        sellAmount,
        poolBuyTokenReserve,
        poolSellTokenReserve,
        limitStore,
        chainStore,
      );

    console.table([ordersToFill, bestAmountOut, newPriceImpact]);

    if (bestAmountOut > amountOut) {
      setlimitState({
        execute: true,
        ordersToFill,
        bestAmountOut: bestAmountOut,
        newPriceImpact: Number(newPriceImpact.toFixed(1)),
      });

      const limitTotalAmountIn = ordersToFill.reduce(
        (acc, order) => acc + order.amountIn,
        0,
      );

      const limitTotalAmountOut = ordersToFill.reduce(
        (acc, order) => acc + order.amountOut,
        0,
      );

      if (currentPool.token0.name === sellTokenObj?.name) {
        const afterPool: Pool = {
          poolId: currentPool.poolId,
          token0: currentPool.token0,
          token1: currentPool.token1,
          token0Amount: (
            Number(currentPool.token0Amount) +
            (sellAmount - limitTotalAmountIn)
          ).toString(),
          token1Amount: (
            Number(currentPool.token1Amount) -
            (bestAmountOut - limitTotalAmountOut)
          ).toString(),
          fee: currentPool.fee,
          lpTokenSupply: currentPool.lpTokenSupply,
        };

        setNewPool(afterPool);
      } else {
        const afterPool: Pool = {
          poolId: currentPool.poolId,
          token0: currentPool.token0,
          token1: currentPool.token1,
          token0Amount: (
            Number(currentPool.token0Amount) -
            (bestAmountOut - limitTotalAmountOut)
          ).toString(),
          token1Amount: (
            Number(currentPool.token1Amount) +
            (sellAmount - limitTotalAmountIn)
          ).toString(),
          fee: currentPool.fee,
          lpTokenSupply: currentPool.lpTokenSupply,
        };

        setNewPool(afterPool);
      }
    } else {
      setlimitState({
        execute: false,
        ordersToFill: [],
        bestAmountOut: 0,
        newPriceImpact: 0,
      });

      if (currentPool.token0.name === sellTokenObj?.name) {
        const afterPool: Pool = {
          poolId: currentPool.poolId,
          token0: currentPool.token0,
          token1: currentPool.token1,
          token0Amount: (
            Number(currentPool.token0Amount) + sellAmount
          ).toString(),
          token1Amount: (
            Number(currentPool.token1Amount) - amountOut
          ).toString(),
          fee: currentPool.fee,
          lpTokenSupply: currentPool.lpTokenSupply,
        };

        setNewPool(afterPool);
      } else {
        const afterPool: Pool = {
          poolId: currentPool.poolId,
          token0: currentPool.token0,
          token1: currentPool.token1,
          token0Amount: (
            Number(currentPool.token0Amount) - amountOut
          ).toString(),
          token1Amount: (
            Number(currentPool.token1Amount) + sellAmount
          ).toString(),
          fee: currentPool.fee,
          lpTokenSupply: currentPool.lpTokenSupply,
        };

        setNewPool(afterPool);
      }
    }

    setState({
      ...state,
      buyAmount: amountOut,
      priceImpact: priceImpact.toFixed(2),
    });
  }, [
    state.sellToken,
    state.buyToken,
    state.sellAmount,
    hasMounted,
    poolStore.poolList,
    chainStore,
    limitStore,
    currentPool,
    sellTokenObj,
    buyTokenObj,
  ]);

  const handleSubmit = async () => {
    let sellToken = sellTokenObj;
    let buyToken = buyTokenObj;

    if (sellToken?.name === buyToken?.name) {
      toast({
        title: "Invalid token selection",
        description: "Please select different tokens to swap",
      });
      return;
    }

    if (!pool || !sellToken || !buyToken || !wallet || !client.client) {
      return;
    }
    const poolModule = client.client.runtime.resolve("PoolModule");
    const sellAmountNum = parseFloat(state.sellAmount);
    if (isNaN(sellAmountNum) || sellAmountNum <= 0) return;

    if (limitState.execute) {
      const tokenIn = TokenId.from(sellToken?.tokenId);
      const tokenOut = TokenId.from(buyToken?.tokenId);
      const amountIn = Balance.from(sellAmountNum * Number(DECIMALS));
      const amountOut = Balance.from(Math.floor(limitState.bestAmountOut));
      const orderbundle = OrderBundle.empty();

      for (
        let i = 0;
        limitState.ordersToFill && i < limitState.ordersToFill.length;
        i++
      ) {
        orderbundle.bundle[i] = Field.from(limitState.ordersToFill[i].orderId);
      }

      const tx = await client.client.transaction(
        PublicKey.fromBase58(wallet),
        async () => {
          await poolModule.swapWithLimit(
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            orderbundle,
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
    } else {
      const tokenIn = TokenId.from(sellToken?.tokenId);
      const tokenOut = TokenId.from(buyToken?.tokenId);
      const amountIn = Balance.from(sellAmountNum * Number(DECIMALS));
      const amountOut = Balance.from(Math.floor(state.buyAmount));

      const tx = await client.client.transaction(
        PublicKey.fromBase58(wallet),
        async () => {
          await poolModule.swap(tokenIn, tokenOut, amountIn, amountOut);
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

  const handleSellAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^[0-9]*\.?[0-9]*$/.test(value)) {
      setState({ ...state, sellAmount: value });
    }
  };

  return (
    <div className="flex h-full w-full items-start justify-center p-2 sm:p-4 md:p-8 xl:pt-16">
      <div className="flex w-full max-w-[470px] sm:w-[470px]">
        <Card className="flex w-full flex-col items-center border-0 shadow-none">
          <div className="mb-2 flex flex-row items-center justify-center gap-2">
            <h2 className="text-2xl font-bold">Swap</h2>
            <Route className="h-6 w-6"></Route>
          </div>

          <div className="flex flex-row items-center rounded-2xl border p-4">
            <Label className="text-custom-input px-3 text-sm">
              Sell
              <CustomInput
                value={state.sellAmount}
                onChange={handleSellAmountChange}
                placeholder={"0"}
                pattern="^[0-9]*[.,]?[0-9]*$"
                inputMode="decimal"
              />
            </Label>

            <Select
              value={state.sellToken}
              onValueChange={(value) => {
                setState({ ...state, sellToken: value });
              }}
            >
              <SelectTrigger className=" w-60 rounded-2xl">
                <SelectValue placeholder="Select a token to swap" />
              </SelectTrigger>

              <SelectContent className=" items-center  rounded-2xl text-center">
                <SelectItem value="MINA">
                  <div className=" flex w-full flex-row gap-4">
                    <img src={`/MINA.png`} className=" h-4 w-4" />
                    MINA
                  </div>
                </SelectItem>
                <SelectItem value="USDT">
                  <div className=" flex w-full flex-row gap-4">
                    <img src={`/USDT.png`} className=" h-4 w-4" />
                    USDT
                  </div>
                </SelectItem>
                <SelectItem value="ETH">
                  <div className=" flex w-full flex-row gap-4">
                    <img src={`/ETH.png`} className=" h-4 w-4" />
                    ETH
                  </div>
                </SelectItem>
                <SelectItem value="BTC">
                  <div className=" flex w-full flex-row gap-4">
                    <img src={`/BTC.png`} className=" h-4 w-4" />
                    BTC
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="relative my-1 w-10">
            <Button
              variant={"outline"}
              className=" absolute bottom-0 left-0 right-0 top-0 mx-auto my-auto border-0  ring-1 ring-border ring-offset-4 hover:bg-card"
              size={"icon"}
              onClick={() => {
                const sellToken = state.sellToken;
                const buyToken = state.buyToken;

                setState({
                  ...state,
                  sellToken: buyToken,
                  buyToken: sellToken,
                });
              }}
            >
              <ArrowUpDown className="h-3 w-3 "></ArrowUpDown>
            </Button>
          </div>

          <div className=" flex flex-row items-center rounded-2xl border p-4">
            <Label className="text-custom-input px-3 text-sm">
              Buy
              <CustomInput
                value={
                  state.buyAmount
                    ? (state.buyAmount / Number(DECIMALS)).toString()
                    : ""
                }
                readOnly
                placeholder={"0"}
                pattern="^[0-9]*[.,]?[0-9]*$"
                inputMode="decimal"
                type="text"
                className=" cursor-default"
              />
              {limitState.execute ? (
                <p className=" text-xl text-green-600">
                  <span className=" text-xs">With LimitSwap:</span>{" "}
                  {(limitState.bestAmountOut / Number(DECIMALS)).toFixed(6)}
                </p>
              ) : null}
              <p
                className={
                  Number(state.priceImpact) > 30
                    ? " text-red-600"
                    : Number(state.priceImpact) > 10
                      ? " text-orange-400"
                      : " "
                }
              >
                Price Impact: {state.priceImpact} %
              </p>
              {limitState.execute ? (
                <p className=" text-green-600">
                  <span className=" text-xs">With LimitSwap:</span>{" "}
                  {limitState.newPriceImpact} %
                </p>
              ) : null}
            </Label>

            <Select
              value={state.buyToken}
              onValueChange={(value) => {
                setState({ ...state, buyToken: value });
              }}
            >
              <SelectTrigger className=" w-60 rounded-2xl">
                <img src={`/${state.buyToken}.png`} className=" h-4 w-4" />
                <SelectValue placeholder="Select a token to swap" />
              </SelectTrigger>

              <SelectContent className=" items-center  rounded-2xl text-center">
                <SelectItem value="MINA">MINA</SelectItem>
                <SelectItem value="USDT">USDT</SelectItem>
                <SelectItem value="ETH">ETH</SelectItem>
                <SelectItem value="BTC">BTC</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            size={"lg"}
            type="submit"
            className="mt-6 w-full rounded-2xl"
            disabled={!wallet || !pool}
            onClick={() => {
              wallet ?? walletStore.connect();
              wallet && handleSubmit();
            }}
          >
            {wallet
              ? pool
                ? limitState.execute
                  ? "LimitLeSwap!"
                  : "Swap"
                : "Pool Not Found"
              : "Connect wallet"}
          </Button>

          {wallet && pool ? (
            seePoolDetails && pool ? (
              <>
                <div className="mt-2 flex w-full justify-start px-2">
                  <p
                    className=" text-custom-input cursor-pointer text-sm"
                    onClick={() => {
                      setSeePoolDetails(false);
                    }}
                  >
                    Hide Impact Chart
                  </p>
                </div>
                <PoolRatio
                  pool={pool}
                  newPool={newPool ? newPool : undefined}
                />
              </>
            ) : (
              <div className="mt-2 flex w-full justify-start px-2">
                <p
                  className=" text-custom-input cursor-pointer text-sm"
                  onClick={() => {
                    setSeePoolDetails(true);
                  }}
                >
                  Show Impact Chart
                </p>
              </div>
            )
          ) : null}
        </Card>
      </div>
    </div>
  );
}
