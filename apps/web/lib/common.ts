import { PoolState } from "./stores/poolStore";

export function findTokenAndPoolByName(
  sellTokenName: string,
  buyTokenName: string,
  poolStore: PoolState,
): [Token | null, Token | null, Pool | null] {
  let sellToken =
    poolStore.tokenList.find((token) => token.name === sellTokenName) ?? null;
  let buyToken =
    poolStore.tokenList.find((token) => token.name === buyTokenName) ?? null;
  const pool =
    poolStore.poolList.find((pool) => {
      return (
        (pool.token0.name === sellToken?.name &&
          pool.token1.name === buyToken?.name) ||
        (pool.token0.name === buyToken?.name &&
          pool.token1.name === sellToken?.name)
      );
    }) ?? null;

  return [sellToken, buyToken, pool];
}

export function calculateLpAddLiquidity(
  tokenAmountA: number,
  tokenAmountB: number,
  tokenReserveA: number,
  tokenReserveB: number,
  lpTotalSupply: number,
): number {
  const lpAmount = Math.min(
    (tokenAmountA * lpTotalSupply) / tokenReserveA,
    (tokenAmountB * lpTotalSupply) / tokenReserveB,
  );
  return lpAmount;
}

export function findTokenByTokenId(
  tokenId: string,
  tokenList: Token[],
): Token | null {
  return tokenList.find((token) => token.tokenId === tokenId) ?? null;
}

export function formatDate(isoString: string) {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const timestamp = date.getTime() / 1000;
  console.log(year, month, day, hours, minutes, seconds, timestamp);
  return {
    year,
    month,
    day,
    hours,
    minutes,
    seconds,
    timestamp,
  };
}
