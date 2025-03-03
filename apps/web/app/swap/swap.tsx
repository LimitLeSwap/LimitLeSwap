"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { useToast } from "@/components/ui/use-toast";
import { ArrowUpDown, Route as RouteIcon } from "lucide-react";

import { useWalletStore } from "@/lib/stores/wallet";
import { usePoolStore } from "@/lib/stores/poolStore";
import { useClientStore } from "@/lib/stores/client";
import { useChartStore, useObserveCandles } from "@/lib/stores/chartStore";
import {
  OrderBundle,
  Route,
  Step,
  useLimitStore,
} from "@/lib/stores/limitStore";
import { useHasMounted } from "@/lib/customHooks";
import { findTokenAndPoolByName } from "@/lib/common";
import { tokens } from "@/lib/tokens";
import { DECIMALS } from "@/lib/constants";
import PriceChart from "./priceChart";

import { PublicKey } from "o1js";
import { PendingTransaction } from "@proto-kit/sequencer";
import { Balance, TokenId } from "@proto-kit/library";
import { Field } from "o1js";
import { useWorkerStore } from "@/lib/stores/workerStore";

export default function Swap() {
  const walletStore = useWalletStore();
  const limitStore = useLimitStore();
  const hasMounted = useHasMounted();
  const poolStore = usePoolStore();
  const client = useClientStore();
  const chartStore = useChartStore();
  const wallet = walletStore.wallet;
  const workerStore = useWorkerStore();

  const [state, setState] = useState({
    sellToken: "MINA",
    buyToken: "USDT",
    sellAmount: "",
    buyAmount: 0,
    priceImpact: "0",
  });

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const [waitApproval, setWaitApproval] = useState(false);
  const [route, setRoute] = useState<CompleteRoute | null>(null);
  // const [limitState, setlimitState] = useState<{
  //   execute: boolean;
  //   ordersToFill: null | any[];
  //   bestAmountOut: number;
  //   newPriceImpact: number;
  // }>({
  //   execute: false,
  //   ordersToFill: [],
  //   bestAmountOut: 0,
  //   newPriceImpact: 0,
  // });
  const [isCalculating, setIsCalculating] = useState(false);

  const { toast } = useToast();

  const [sellTokenObj, buyTokenObj, pool] = useMemo(() => {
    return findTokenAndPoolByName(state.sellToken, state.buyToken, poolStore);
  }, [
    state.sellToken,
    state.buyToken,
    poolStore.poolList,
    poolStore.tokenList,
  ]);

  useEffect(() => {
    if (hasMounted && !workerStore.isReady) {
      workerStore.startWorker();
    }
  }, [hasMounted]);

  useEffect(() => {
    if (!hasMounted) return;
    if (!workerStore.isReady) return;
    if (!sellTokenObj || !buyTokenObj) return;

    const sellAmountNum = parseFloat(state.sellAmount);
    if (isNaN(sellAmountNum) || sellAmountNum <= 0.001) {
      setState((prev) => ({ ...prev, buyAmount: 0 }));
      setRoute(null);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // console.log("debounceRef.current", debounceRef.current);

    setIsCalculating(true);
    debounceRef.current = setTimeout(() => {
      const sellAmountRaw = Math.floor(sellAmountNum * Number(DECIMALS));

      console.log("send message to worker");
      workerStore
        .findRoute(
          sellTokenObj,
          buyTokenObj,
          sellAmountRaw,
          {
            tokenList: poolStore.tokenList,
            poolList: poolStore.poolList,
            positionList: poolStore.positionList,
          } as PoolStoreState,
          {
            limitOrders: limitStore.limitOrders,
          } as LimitStoreState,
        )
        .then((route) => {
          console.log("route", route);
          setRoute(route);
          setIsCalculating(false);
        });
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [
    hasMounted,
    state.sellAmount,
    state.sellToken,
    state.buyToken,
    sellTokenObj,
    buyTokenObj,
    poolStore,
    limitStore,
  ]);

  useEffect(() => {
    if (route?.finalAmountOut) {
      setState((prev) => ({
        ...prev,
        buyAmount: route.finalAmountOut,
      }));
    }
  }, [route]);

  useEffect(() => {
    if (pool) {
      chartStore.setPool(pool);
    }
  }, [pool]);

  useObserveCandles();

  const handleSubmit = async () => {
    try {
      setWaitApproval(true);
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

      console.log("swap route", route);

      if (route.steps.length === 1) {
        if (route.steps[0].orders.length > 0) {
          console.log("swap with limit");
          const tokenIn = TokenId.from(sellToken?.tokenId);
          const tokenOut = TokenId.from(buyToken?.tokenId);
          const amountIn = Balance.from(route.steps[0].amountIn);
          const amountOut = Balance.from(route.steps[0].amountOut);
          const orderbundle = OrderBundle.empty();
          for (let i = 0; i < route.steps[0].orders.length; i++) {
            orderbundle.bundle[i] = Field.from(
              route.steps[0].orders[i].orderId,
            );
          }
          console.log(
            "swap with limit",
            tokenIn.toString(),
            tokenOut.toString(),
            amountIn.toString(),
            amountOut.toString(),
            orderbundle.bundle.map((x) => x.toString()),
          );
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
            throw new Error("Transaction failed");
          }
        } else {
          console.log("swap without limit");
          const tokenIn = TokenId.from(sellToken?.tokenId);
          const tokenOut = TokenId.from(buyToken?.tokenId);
          const amountIn = Balance.from(route.steps[0].amountIn);
          const amountOut = Balance.from(route.steps[0].amountOut);

          console.log(
            "swap without limit",
            tokenIn.toString(),
            tokenOut.toString(),
            amountIn.toString(),
            amountOut.toString(),
          );

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
            throw new Error("Transaction failed");
          }
        }
      } else if (route.steps.length > 1) {
        console.log("swap with route");
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
            Balance.from(step.amountIn),
            Balance.from(step.amountOut),
            limitOrders,
          );
        }

        console.log("tradeRoute", tradeRoute);

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
          throw new Error("Transaction failed");
        }
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Transaction failed",
        description: "Please try again",
      });
    } finally {
      setWaitApproval(false);
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
      <div className="flex w-full max-w-[470px] flex-col gap-8 sm:w-[470px]">
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
                  !isCalculating && state.buyAmount
                    ? (state.buyAmount / Number(DECIMALS)).toFixed(4)
                    : ""
                }
                readOnly
                placeholder={isCalculating ? "..." : "0"}
                pattern="^[0-9]*[.,]?[0-9]*$"
                inputMode="decimal"
                type="text"
                className=" cursor-default"
              />
              {/* {limitState.execute ? (
                <p className=" text-xl text-green-600">
                  <span className=" text-xs">With LimitSwap:</span>{" "}
                  {(limitState.bestAmountOut / Number(DECIMALS)).toFixed(6)}
                </p>
              ) : null} */}
              {/* <p
                className={
                  Number(state.priceImpact) > 30
                    ? " text-red-600"
                    : Number(state.priceImpact) > 10
                      ? " text-orange-400"
                      : " "
                }
              >
                Price Impact: {state.priceImpact} %
              </p> */}
              {/* {limitState.execute ? (
                <p className=" text-green-600">
                  <span className=" text-xs">With LimitSwap:</span>{" "}
                  {limitState.newPriceImpact} %
                </p>
              ) : null} */}
            </Label>

            <Select
              value={state.buyToken}
              onValueChange={(value) => {
                setState({ ...state, buyToken: value });
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

          <Button
            size={"lg"}
            type="submit"
            className="mt-6 w-full rounded-2xl"
            disabled={client.loading || waitApproval}
            loading={client.loading || waitApproval}
            onClick={() => {
              wallet ?? walletStore.connect();
              wallet && route && handleSubmit();
            }}
          >
            {wallet
              ? waitApproval
                ? "Waiting Approval"
                : "Swap"
              : "Connect wallet"}
          </Button>
        </Card>
        <PriceChart
          candleData={
            pool?.token0.name === state.sellToken
              ? chartStore.chartData1
              : chartStore.chartData0
          }
          volumeData={
            pool?.token0.name === state.sellToken
              ? chartStore.chartData1
              : chartStore.chartData0
          }
        />
      </div>
    </div>
  );
}
