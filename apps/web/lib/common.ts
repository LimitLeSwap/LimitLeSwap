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

export function findTokenByTokenId(
  tokenId: string,
  tokenList: Token[],
): Token | null {
  return tokenList.find((token) => token.tokenId === tokenId) ?? null;
}
