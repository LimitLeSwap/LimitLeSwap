"use client";
import { Button } from "@/components/ui/button";
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
import { useClientStore } from "@/lib/stores/client";
import { usePoolStore } from "@/lib/stores/poolStore";
import { useWalletStore } from "@/lib/stores/wallet";
import { ArrowUpDown } from "lucide-react";
import { PublicKey, UInt64 } from "o1js";
import { Balance, TokenId } from "@proto-kit/library";
import React, { useEffect, useState } from "react";
import OrderBook from "@/components/orderBook";
import MyOrders from "@/components/myOrders";
import { DECIMALS } from "@/lib/constants";
import { PendingTransaction } from "@proto-kit/sequencer";
import { Card } from "@/components/ui/card";

export default function LimitOrder() {
  const walletStore = useWalletStore();
  const wallet = walletStore.wallet;
  const client = useClientStore();
  const { toast } = useToast();
  const poolStore = usePoolStore();

  const [state, setState] = useState({
    sellToken: "MINA",
    buyToken: "USDT",
    sellAmount: "",
    buyAmount: "",
    rate: "",
    validForDays: 1,
  });

  useEffect(() => {
    if (Number(state.sellAmount) > 0 && Number(state.buyAmount) > 0) {
      const rate = (Number(state.buyAmount) / Number(state.sellAmount)).toFixed(
        2,
      );
      setState({
        ...state,
        rate,
      });
    } else {
      setState({
        ...state,
        rate: "",
      });
    }
  }, [state.buyAmount, state.sellAmount]);

  const handleSubmit = async () => {
    console.log(state);

    let sellToken = poolStore.tokenList.find(
      (token) => token.name === state.sellToken,
    );
    let buyToken = poolStore.tokenList.find(
      (token) => token.name === state.buyToken,
    );

    if (sellToken?.name === buyToken?.name) {
      toast({
        title: "Invalid token selection",
        description: "Please select different tokens to swap",
      });
      return;
    }

    const sellAmount = state.sellAmount;
    const buyAmount = state.buyAmount;
    const validForDays = state.validForDays;

    console.log({
      sellToken,
      buyToken,
      sellAmount,
      buyAmount,
      validForDays,
    });

    if (client.client && wallet && sellToken && buyToken) {
      const orderbook = client.client.runtime.resolve("OrderBook");
      const tokenIn = TokenId.from(sellToken.tokenId);
      const tokenOut = TokenId.from(buyToken.tokenId);
      const amountIn = Balance.from(
        BigInt(Number(sellAmount) * Number(DECIMALS)),
      );
      const amountOut = Balance.from(
        BigInt(Number(buyAmount) * Number(DECIMALS)),
      );
      const expiration = UInt64.from(validForDays * 17280);
      const tx = await client.client.transaction(
        PublicKey.fromBase58(wallet),
        async () => {
          await orderbook.createLimitOrder(
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            expiration,
          );
        },
      );
      console.log("Creating limit order");
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

  const handleBuyAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^[0-9]*\.?[0-9]*$/.test(value)) {
      setState({ ...state, buyAmount: value });
    }
  };

  return (
    <div className="flex h-full w-full items-start justify-center p-2 sm:p-4 md:p-8 xl:pt-16">
      <div className="flex w-full max-w-[470px] sm:w-[470px]">
        <Card className="flex w-full flex-col items-center border-0 shadow-none">
          <div className="mb-2 flex flex-row items-center justify-center gap-2">
            <h2 className="text-2xl font-bold">Create Limit Orders</h2>
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

          <div className="flex flex-row items-center rounded-2xl border p-4">
            <Label className="text-custom-input px-3 text-sm">
              Buy
              <CustomInput
                value={state.buyAmount}
                onChange={handleBuyAmountChange}
                placeholder={"0"}
                pattern="^[0-9]*[.,]?[0-9]*$"
                inputMode="decimal"
              />
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

          <div className="my-2 grid grid-cols-5 flex-row items-center rounded-2xl border p-4">
            <div className=" col-span-3">
              <Label className="text-custom-input px-3 text-sm">
                {state.sellToken} / {state.buyToken} Rate
                <CustomInput
                  className=" text-xl"
                  value={state.rate}
                  placeholder="0"
                  readOnly
                  type="text"
                />
              </Label>
            </div>

            <div className=" col-span-2">
              <Label className="text-custom-input px-3 text-sm">
                Valid For Days
                <CustomInput
                  value={state.validForDays}
                  onChange={(e) => {
                    setState({
                      ...state,
                      validForDays: Number(e.target.value),
                    });
                  }}
                  placeholder={"0"}
                  pattern="^[0-9]*[.,]?[0-9]*$"
                  minLength={1}
                  maxLength={40}
                  inputMode="decimal"
                  type="number"
                />
              </Label>
            </div>
          </div>
          <Button
            size={"lg"}
            type="submit"
            className="mt-6 w-full rounded-2xl"
            onClick={() => {
              wallet ?? walletStore.connect();
              wallet && handleSubmit();
            }}
          >
            {wallet ? "Place Order" : "Connect wallet"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
