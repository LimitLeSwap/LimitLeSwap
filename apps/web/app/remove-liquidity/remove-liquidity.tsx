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
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/use-toast";
import { DECIMALS } from "@/lib/constants";
import { useHasMounted } from "@/lib/customHooks";
import { useClientStore } from "@/lib/stores/client";
import { usePoolStore } from "@/lib/stores/poolStore";
import { useWalletStore } from "@/lib/stores/wallet";
import { Balance, TokenId } from "@proto-kit/library";
import { PendingTransaction } from "@proto-kit/sequencer";
import { ArrowDown, Flame } from "lucide-react";
import { PublicKey } from "o1js";
import React, { useEffect, useState } from "react";

export default function RemoveLiq() {
  const walletStore = useWalletStore();
  const hasMounted = useHasMounted();
  const poolStore = usePoolStore();
  const client = useClientStore();

  const wallet = walletStore.wallet;

  const { toast } = useToast();

  const [waitApproval, setWaitApproval] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [state, setState] = useState({
    selectedPosition: "0",
    removeAmount: 0,
  });

  useEffect(() => {
    if (!client.client) return;
    setPosition(poolStore.positionList[Number(state.selectedPosition)]);
  }, [
    state.selectedPosition,
    hasMounted,
    poolStore.positionList,
    client.client,
  ]);

  const handleSubmit = async () => {
    if (state.removeAmount === 0) return;

    setWaitApproval(true);
    if (!position) {
      toast({
        title: "Error",
        description: "Please select a position",
      });
      setWaitApproval(false);
      return;
    }
    try {
      if (client.client && wallet) {
        const poolModule = client.client.runtime.resolve("PoolModule");
        const removeAmount0 = Math.floor(
          (Number(position.token0Amount) * state.removeAmount) /
            Number(position.lpTokenAmount),
        );
        const removeAmount1 = Math.floor(
          (Number(position.token1Amount) * state.removeAmount) /
            Number(position.lpTokenAmount),
        );

        const tx = await client.client.transaction(
          PublicKey.fromBase58(wallet),
          async () => {
            await poolModule.removeLiquidity(
              TokenId.from(position.token0.tokenId),
              TokenId.from(position.token1.tokenId),
              Balance.from(removeAmount0),
              Balance.from(removeAmount1),
              Balance.from(state.removeAmount),
            );
          },
        );

        console.log("Remove", removeAmount0, removeAmount1, state.removeAmount);
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

        setState({
          ...state,
          removeAmount: 0,
        });
        setWaitApproval(false);
      }
    } catch (e) {
      toast({
        title: "Transaction failed",
        description: "Please try again",
      });
      console.error(e);
      setWaitApproval(false);
    }
  };

  return (
    <div className="flex h-full w-full items-start justify-center p-2 sm:p-4 md:p-8 xl:pt-16">
      <div className="flex w-full max-w-[470px] sm:w-[470px]">
        <Card className="flex w-full flex-col items-center border-0 shadow-none">
          <div className="mb-2 flex flex-row items-center justify-center gap-2">
            <h2 className="text-2xl font-bold">Remove Liquidity</h2>
            <Flame className="h-6 w-6" />
          </div>

          <div className="flex flex-col items-center gap-4 rounded-2xl border p-4 px-6 pb-6">
            <div className="flex flex-row items-center">
              <div className=" flex flex-col">
                <Label className=" text-lg">
                  {" "}
                  Remove Position
                  <p className=" px-2 py-2 text-4xl">
                    {position
                      ? Math.ceil(
                          (state.removeAmount /
                            Number(position?.lpTokenAmount)) *
                            100,
                        )
                      : 0}{" "}
                    %
                  </p>
                </Label>
                <Label className="mt-2">
                  {" "}
                  Remove LP Amount
                  <CustomInput
                    value={
                      Number(state.removeAmount / Number(DECIMALS)).toFixed(
                        2,
                      ) ?? "0"
                    }
                    placeholder={"0"}
                    pattern="^[0-9]*[.,]?[0-9]*$"
                    minLength={1}
                    maxLength={40}
                    inputMode="decimal"
                    className=" px-2 text-xl"
                    onChange={(e) => {
                      const newValue = parseFloat(e.target.value) || 0;
                      setState({
                        ...state,
                        removeAmount: Math.floor(newValue * Number(DECIMALS)),
                      });
                    }}
                  />
                </Label>
              </div>

              <Select
                value={state.selectedPosition}
                onValueChange={(value) => {
                  setState({
                    ...state,
                    selectedPosition: value,
                    removeAmount: 0,
                  });
                }}
                disabled={poolStore.positionList.length === 0}
              >
                <SelectTrigger className=" w-60 rounded-2xl">
                  {position ? (
                    <div className="relative flex h-4 w-6">
                      <div className=" absolute top-0">
                        <img
                          src={`/${position?.token0.name}.png`}
                          className="h-4 w-4"
                        />
                      </div>
                      <div className=" absolute left-2">
                        <img
                          src={`/${position?.token1.name}.png`}
                          className="h-4 w-4"
                        />
                      </div>
                    </div>
                  ) : null}
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>

                <SelectContent className=" items-center  rounded-2xl text-center">
                  {poolStore.positionList.map((position, i) => {
                    return (
                      <SelectItem key={i} value={i.toString()}>
                        {position.token0.name} / {position.token1.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <Slider
              value={[
                (poolStore.positionList.length === 0 || !position
                  ? 0
                  : state.removeAmount / Number(position?.lpTokenAmount)) * 100,
              ]}
              step={1}
              onValueChange={(value) => {
                const newLpTokenAmount =
                  (Number(position?.lpTokenAmount) * value[0]) / 100;
                setState({
                  ...state,
                  removeAmount: Math.floor(newLpTokenAmount),
                });
              }}
              disabled={poolStore.positionList.length === 0 || !position}
              className="cursor-pointer"
            />
          </div>

          <div className="my-2 flex w-10 items-center justify-center">
            <ArrowDown className="h-6 w-6" />
          </div>

          <div className=" flex w-full flex-col items-center justify-center rounded-2xl border p-4">
            {position ? (
              <>
                <h3 className="text-base">You will receive</h3>
                <div className=" flex w-full flex-row items-center justify-between px-3 py-1">
                  <p className="flex h-12 items-center justify-start text-xl">
                    {position
                      ? (
                          (Number(position?.token0Amount) *
                            state.removeAmount) /
                          Number(position?.lpTokenAmount) /
                          Number(DECIMALS)
                        ).toFixed(3)
                      : "0"}
                  </p>
                  <div className=" flex flex-row items-center gap-1">
                    <img
                      src={`/${position?.token0.name}.png`}
                      className="flex h-6 w-6"
                    />
                    <p className="flex">{position?.token0.name}</p>
                  </div>
                </div>
                <div className=" flex w-full flex-row items-center justify-between px-3 py-1">
                  <p className="flex h-12 items-center justify-start text-xl">
                    {position
                      ? (
                          (Number(position?.token1Amount) *
                            state.removeAmount) /
                          Number(position?.lpTokenAmount) /
                          Number(DECIMALS)
                        ).toFixed(3)
                      : 0}
                  </p>
                  <div className=" flex flex-row items-center gap-1">
                    <img
                      src={`/${position?.token1.name}.png`}
                      className="h-6 w-6"
                    />
                    <p>{position?.token1.name}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-base">Select a position to remove liquidity</p>
            )}
          </div>

          <Button
            size={"lg"}
            type="submit"
            className="mt-6 w-full rounded-2xl"
            disabled={!position || waitApproval}
            loading={waitApproval}
            onClick={() => {
              wallet ?? walletStore.connect();
              wallet && handleSubmit();
            }}
          >
            {wallet
              ? poolStore.positionList.length > 0
                ? waitApproval
                  ? "Waiting Approval"
                  : "Remove Liquidity"
                : "No Positions Found"
              : "Connect wallet"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
