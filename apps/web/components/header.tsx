import { Button } from "@/components/ui/button";
// @ts-ignore
import truncateMiddle from "truncate-middle";
import { Skeleton } from "@/components/ui/skeleton";
import { Chain } from "./chain";
import { Separator } from "./ui/separator";
import { ArrowRightLeft, Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useBalancesStore } from "@/lib/stores/balances";
import { usePoolStore } from "@/lib/stores/poolStore";
import { ModeToggle } from "./mode-toggle";
import { DECIMALS } from "@/lib/constants";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { ScrollArea } from "./ui/scroll-area";

export interface HeaderProps {
  loading: boolean;
  wallet?: string;
  onConnectWallet: () => void;
  balance?: string;
  balanceLoading: boolean;
  blockHeight?: string;
}

export default function Header({
  loading,
  wallet,
  onConnectWallet,
  balance,
  balanceLoading,
  blockHeight,
}: HeaderProps) {
  const router = useRouter();
  const handleNavigate = (path: string) => {
    router.push(path);
  };
  const balances = useBalancesStore();
  const poolStore = usePoolStore();
  return (
    <div className="flex items-center p-4 py-6 sm:justify-start md:justify-evenly xl:justify-between">
      <div className=" flex ">
        <ArrowRightLeft className="-rotate-45 sm:h-4 sm:w-4 md:h-6 md:w-6 xl:h-8 xl:w-8" />
        <p
          className="ml-1 cursor-pointer whitespace-nowrap font-bold sm:text-sm md:ml-2 md:text-lg xl:text-2xl"
          onClick={() => {
            handleNavigate("/");
          }}
        >
          LimitLe Swap
        </p>
      </div>
      <div className="hidden flex-grow justify-between sm:flex">
        <div className="flex  items-center justify-start">
          <Separator
            className="mx-2 sm:h-4 md:mx-2 md:h-6 xl:mx-4 xl:h-8"
            orientation={"vertical"}
          />
          <Button
            variant={"hover"}
            className="xl:text-md sm:h-9 sm:px-2 sm:text-sm xl:h-10 xl:px-4"
            onClick={() => {
              handleNavigate("/swap");
            }}
          >
            Swap
          </Button>
          <Button
            variant={"hover"}
            className="xl:text-md sm:h-9 sm:px-2 sm:text-sm xl:h-10 xl:px-4"
            onClick={() => {
              handleNavigate("/limit-order");
            }}
          >
            Limit Order
          </Button>
          <Popover>
            <PopoverTrigger>
              <Button
                variant={"hover"}
                className="xl:text-md sm:h-9 sm:px-2 sm:text-sm xl:h-10 xl:px-4"
              >
                Pool
              </Button>
            </PopoverTrigger>
            <PopoverContent className="hidden w-20 flex-col gap-1 rounded-2xl p-1 sm:flex sm:w-32 md:w-36 md:gap-2 xl:w-48 xl:gap-4">
              <Button
                variant={"hover"}
                className="xl:text-md rounded-2xl hover:bg-gray-100 sm:h-8 sm:px-2 sm:text-sm xl:h-10 xl:px-4"
                onClick={() => {
                  handleNavigate("/create-pool");
                }}
              >
                Create Pool
              </Button>
              <Button
                variant={"hover"}
                className="xl:text-md rounded-2xl hover:bg-gray-100 sm:h-8 sm:px-2 sm:text-sm xl:h-10 xl:px-4"
                onClick={() => {
                  handleNavigate("/add-liquidity");
                }}
              >
                Add Liquidity
              </Button>
              <Button
                variant={"hover"}
                className="xl:text-md rounded-2xl hover:bg-gray-100 sm:h-8 sm:px-2 sm:text-sm xl:h-10 xl:px-4"
                onClick={() => {
                  handleNavigate("/remove-liquidity");
                }}
              >
                Remove Liquidity
              </Button>
              <Button
                variant={"hover"}
                className="xl:text-md rounded-2xl hover:bg-gray-100 sm:h-8 sm:px-2 sm:text-sm xl:h-10 xl:px-4"
                onClick={() => {
                  handleNavigate("/positions");
                }}
              >
                Positions
              </Button>
            </PopoverContent>
          </Popover>
          <Button
            variant={"hover"}
            className="xl:text-md sm:h-9 sm:px-2 sm:text-sm xl:h-10 xl:px-4"
            onClick={() => {
              handleNavigate("/faucet");
            }}
          >
            Faucet
          </Button>
        </div>
        <div className="flex basis-6/12 flex-row items-center justify-end">
          {wallet && (
            <div className="mr-4 flex shrink flex-col items-end justify-center">
              <div>
                <p className="whitespace-nowrap text-xs md:text-xs">
                  Your balance
                </p>
              </div>
              <div className="pt-0.5 text-right sm:w-16 md:w-24 xl:w-32">
                {balanceLoading && balance === undefined ? (
                  <Skeleton className="h-4 w-full" />
                ) : (
                  <Popover>
                    <PopoverTrigger>
                      <p className="font-bold sm:text-sm xl:text-base">
                        {(
                          BigInt(balances.balances["MINA"] ?? 0) / DECIMALS
                        ).toString()}{" "}
                        MINA
                      </p>
                    </PopoverTrigger>
                    <PopoverContent className="flex w-fit flex-col gap-4 rounded-2xl p-4 px-6">
                      {poolStore.tokenList.map((token) => {
                        return (
                          <div
                            key={token.name}
                            className="flex flex-row justify-end text-right text-sm font-bold"
                          >
                            {(
                              BigInt(balances.balances[token.name] ?? 0) /
                              DECIMALS
                            ).toString()}{" "}
                            {token.name}
                          </div>
                        );
                      })}
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          )}
          <Button
            loading={loading}
            className="rounded-2xl sm:w-24 md:w-28 xl:w-32"
            onClick={onConnectWallet}
          >
            <div className="sm:text-xs md:text-sm xl:text-base">
              {wallet ? truncateMiddle(wallet, 4, 4, "...") : "Connect wallet"}
            </div>
          </Button>
          <ModeToggle />
        </div>
      </div>
      <div className=" flex flex-grow justify-between sm:hidden">
        <Drawer>
          <DrawerTrigger>
            {" "}
            <Menu className="ml-2 h-6 w-6" />
          </DrawerTrigger>
          <DrawerContent>
            <ScrollArea>
              <nav className="flex flex-col items-start gap-1">
                <Button
                  variant="ghost"
                  onClick={() => handleNavigate("/swap")}
                  className="text-left"
                >
                  Swap
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleNavigate("/limit-order")}
                  className="text-left"
                >
                  Limit Order
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleNavigate("/create-pool")}
                  className="text-left"
                >
                  Create Pool
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleNavigate("/add-liquidity")}
                  className="text-left"
                >
                  Add Liquidity
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleNavigate("/remove-liquidity")}
                  className="text-left"
                >
                  Remove Liquidity
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleNavigate("/positions")}
                  className="text-left"
                >
                  Positions
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleNavigate("/faucet")}
                  className="text-left"
                >
                  Faucet
                </Button>
              </nav>
              <ModeToggle />
            </ScrollArea>
          </DrawerContent>
        </Drawer>
        <div className="flex flex-row items-center self-end">
          <Button
            loading={loading}
            className="w-24 rounded-2xl"
            onClick={onConnectWallet}
          >
            <div className=" text-xs">
              {wallet ? (
                <Drawer>
                  <DrawerTrigger>
                    {truncateMiddle(wallet, 4, 4, "...")}
                  </DrawerTrigger>
                  <DrawerContent>
                    {poolStore.tokenList.map((token) => {
                      return (
                        <div
                          key={token.name}
                          className="flex flex-row justify-end text-right text-sm font-bold"
                        >
                          {(
                            BigInt(balances.balances[token.name] ?? 0) /
                            DECIMALS
                          ).toString()}{" "}
                          {token.name}
                        </div>
                      );
                    })}
                  </DrawerContent>
                </Drawer>
              ) : (
                "Connect wallet"
              )}
            </div>
          </Button>
        </div>
      </div>
      <div className=" fixed bottom-2 right-2 p-2">
        <Chain height={blockHeight} />
      </div>
    </div>
  );
}
