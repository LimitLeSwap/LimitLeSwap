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
import { ArrowUpDown, Route as RouteIcon } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { usePoolStore } from "@/lib/stores/poolStore";
import { useHasMounted } from "@/lib/customHooks";
import { useClientStore } from "@/lib/stores/client";
import { Balance, TokenId } from "@proto-kit/library";
import { useToast } from "@/components/ui/use-toast";
import { Field, PublicKey } from "o1js";
import { DECIMALS } from "@/lib/constants";
import { findPool } from "./utils/swapFunctions";
import { Route, Step } from "@/lib/stores/limitStore";
import { OrderBundle, useLimitStore } from "@/lib/stores/limitStore";
import { useChainStore } from "@/lib/stores/chain";
import { PendingTransaction } from "@proto-kit/sequencer";
import { findBestRoute } from "./utils/findRoute";

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
  const [route, setRoute] = useState<CompleteRoute | null>(null);
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

  const [sellTokenObj, buyTokenObj] = useMemo(() => {
    return findPool(state.sellToken, state.buyToken, poolStore);
  }, [
    state.sellToken,
    state.buyToken,
    poolStore.poolList,
    poolStore.tokenList,
  ]);

  useEffect(() => {
    if (!hasMounted || !sellTokenObj || !buyTokenObj) {
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

    const route = findBestRoute(
      sellTokenObj,
      buyTokenObj,
      sellAmount,
      poolStore,
      limitStore,
      Number(chainStore.block?.height ?? 0),
    );

    console.log(route);
    if (!route) return;
    setRoute(route);

    setState({
      ...state,
      buyAmount: Number(route.finalAmountOut) ?? 0,
    });
  }, [
    state.sellToken,
    state.buyToken,
    state.sellAmount,
    hasMounted,
    poolStore.poolList,
    chainStore,
    limitStore,
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

    if (!route || !sellToken || !buyToken || !wallet || !client.client) {
      return;
    }
    const poolModule = client.client.runtime.resolve("PoolModule");
    const routerModule = client.client.runtime.resolve("RouterModule");
    const sellAmountNum = parseFloat(state.sellAmount);
    if (isNaN(sellAmountNum) || sellAmountNum <= 0) return;

    if (route.steps.length === 1) {
      if (route.steps[0].orders.length > 0) {
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
          orderbundle.bundle[i] = Field.from(
            limitState.ordersToFill[i].orderId,
          );
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
    } else if (route.steps.length > 1) {
      let tradeRoute = Route.empty();

      for (let i = 0; i < route.steps.length; i++) {
        const step = route.steps[i];

        const limitOrders = OrderBundle.empty();

        for (let j = 0; j < step.orders.length; j++) {
          limitOrders.bundle[j] = Field.from(step.orders[j].orderId);
        }

        tradeRoute.path[i] = Step.from(
          TokenId.from(step.tokenIn.tokenId),
          TokenId.from(step.tokenOut.tokenId),
          Balance.from(Math.floor(step.amountIn)),
          Balance.from(Math.floor(step.amountOut)),
          limitOrders,
        );
      }

      const tx = await client.client.transaction(
        PublicKey.fromBase58(wallet),
        async () => {
          await routerModule.tradeRoute(tradeRoute);
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
            <RouteIcon className="h-6 w-6"></RouteIcon>
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
                    ? (state.buyAmount / Number(DECIMALS)).toFixed(4)
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
            disabled={client.loading}
            onClick={() => {
              wallet ?? walletStore.connect();
              wallet && route && handleSubmit();
            }}
          >
            {wallet
              ? route
                ? limitState.execute
                  ? "LimitLeSwap!"
                  : "Swap"
                : "Pool Not Found"
              : "Connect wallet"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
