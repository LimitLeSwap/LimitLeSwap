"use client";
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePoolStore } from "@/lib/stores/poolStore";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { DECIMALS } from "@/lib/constants";

export default function Positions() {
  const poolStore = usePoolStore();
  const router = useRouter();

  return (
    <div className="flex h-full w-full items-start justify-center p-2 sm:p-4 md:p-8 xl:pt-16">
      <div className="flex w-full max-w-[470px] sm:w-[470px]">
        <div className="flex w-full flex-col items-center">
          <h2 className=" p-4 text-lg font-bold">My Positions</h2>
          <div className="w-full rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Pair</TableHead>
                  <TableHead className="text-center">Pool Tokens</TableHead>
                  <TableHead className="text-center">Reserved Tokens</TableHead>
                  <TableHead className="text-center">Pool Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poolStore.positionList.length > 0 ? (
                  poolStore.positionList.map((position, i) => (
                    <Dialog key={i}>
                      <DialogTrigger asChild>
                        <TableRow key={i} className=" cursor-pointer">
                          <TableCell className="flex flex-row items-center justify-around text-center">
                            <div className="relative flex h-4 w-8">
                              <div className=" absolute top-0">
                                <img
                                  src={`/${position.token0.name}.png`}
                                  className="h-4 w-4"
                                />
                              </div>
                              <div className=" absolute left-2">
                                <img
                                  src={`/${position.token1.name}.png`}
                                  className="h-4 w-4"
                                />
                              </div>
                            </div>
                            <span className="flex">
                              {position.token0.name} / {position.token1.name}
                            </span>
                          </TableCell>
                          <TableCell className=" text-center">
                            {(
                              Number(position.lpTokenAmount) / Number(DECIMALS)
                            ).toFixed(2)}
                          </TableCell>
                          <TableCell className=" flex flex-col items-center justify-center gap-2">
                            <div>
                              {(
                                Number(position.token0Amount) / Number(DECIMALS)
                              ).toFixed(2)}{" "}
                              {position.token0.name}
                            </div>
                            <div>
                              {(
                                Number(position.token1Amount) / Number(DECIMALS)
                              ).toFixed(2)}{" "}
                              {position.token1.name}
                            </div>
                          </TableCell>
                          <TableCell className=" text-center">
                            {(
                              (Number(position.lpTokenAmount) /
                                Number(position.lpTokenTotalSupply)) *
                              100
                            ).toFixed(1)}{" "}
                            %
                          </TableCell>
                        </TableRow>
                      </DialogTrigger>
                      <DialogContent className="rounded-2xl sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>
                            Manage {position.token0.name} /{" "}
                            {position.token1.name} Position
                          </DialogTitle>
                          <DialogDescription>
                            As you provide liquidity, you receive a share of the{" "}
                            %
                            {Number(
                              poolStore.poolList.find(
                                (pool) =>
                                  pool.token0.name === position.token0.name &&
                                  pool.token1.name === position.token1.name,
                              )?.fee,
                            ) / 100}{" "}
                            fee cut from all swap transactions made on the pool
                            according to your pool share.
                          </DialogDescription>
                        </DialogHeader>

                        <div className=" flex flex-col gap-2 p-2">
                          <div className=" flex w-full flex-row justify-between">
                            <div className="flex text-base">
                              LP Token Amount:
                            </div>
                            <div className="flex">
                              {(
                                Number(position.lpTokenAmount) /
                                Number(DECIMALS)
                              ).toFixed(3)}
                            </div>
                          </div>

                          <div className=" flex w-full flex-row justify-between">
                            <div className="flex text-base">
                              Pooled {position.token0.name} Amount:
                            </div>
                            <div className="flex">
                              {(
                                Number(position.token0Amount) / Number(DECIMALS)
                              ).toFixed(3)}
                            </div>
                          </div>

                          <div className=" flex w-full flex-row justify-between">
                            <div className="flex text-base">
                              Pooled {position.token1.name} Amount:
                            </div>
                            <div className="flex">
                              {(
                                Number(position.token1Amount) / Number(DECIMALS)
                              ).toFixed(3)}
                            </div>
                          </div>

                          <div className=" flex w-full flex-row justify-between">
                            <div className="flex text-base">Pool Share:</div>
                            <div className="flex">
                              {(Number(position.lpTokenAmount) /
                                Number(position.lpTokenTotalSupply)) *
                                100}{" "}
                              %
                            </div>
                          </div>
                        </div>

                        <DialogFooter className=" gap-4">
                          <Button
                            className=" w-24 rounded-2xl"
                            onClick={() => router.push("/add-liquidity")}
                          >
                            Add
                          </Button>
                          <Button
                            className=" w-24 rounded-2xl"
                            onClick={() => router.push("/remove-liquidity")}
                          >
                            Remove
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className=" text-center">
                      No positions found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
