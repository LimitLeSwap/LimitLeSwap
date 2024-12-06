import { Token } from "@/lib/stores/poolStore";
import { useLimitStore } from "@/lib/stores/limitStore";
import { useChainStore } from "@/lib/stores/chain";

export const calculateWithLimitOrders = (
  buyToken: Token,
  sellToken: Token,
  amountOut: number,
  sellAmount: number,
  poolBuyTokenReserve: number,
  poolSellTokenReserve: number,
) => {
  const limitStore = useLimitStore();
  const chainStore = useChainStore();

  const limitOrders = limitStore.limitOrders
    .filter((order) => {
      return (
        order.isActive &&
        Number(order.expiration) > Number(chainStore.block?.height ?? 0) &&
        order.tokenIn === buyToken?.tokenId &&
        order.tokenOut === sellToken?.tokenId &&
        amountOut / sellAmount <=
          Number(order.tokenInAmount) / Number(order.tokenOutAmount)
      );
    })
    .map((order) => {
      return {
        price: Number(order.tokenInAmount) / Number(order.tokenOutAmount),
        amountIn: Number(order.tokenInAmount),
        amountOut: Number(order.tokenOutAmount),
        orderId: order.orderId,
        tokenIn: order.tokenIn,
        tokenOut: order.tokenOut,
      };
    })
    .sort((a, b) => -(a.price - b.price));

  const { amountOut: amountOutWithoutLimitOrders } = calculateSwap(
    poolBuyTokenReserve,
    poolSellTokenReserve,
    sellAmount,
  );

  let bestAmountOut = amountOutWithoutLimitOrders;
  const ordersToFill: any[] = [];
  let remainingAmountOut = sellAmount;
  let totalAmountIn = 0;

  // Simplistic greedy algorithm
  for (let i = 0; i < Math.min(limitOrders.length, 10); i++) {
    const order = limitOrders[i];
    if (order.amountOut <= remainingAmountOut) {
      const { amountOut } = calculateSwap(
        poolBuyTokenReserve,
        poolSellTokenReserve,
        remainingAmountOut - order.amountOut,
      );
      if (amountOut + order.amountIn + totalAmountIn > bestAmountOut) {
        ordersToFill.push(order);
        totalAmountIn += order.amountIn;
        remainingAmountOut -= order.amountOut;
        bestAmountOut = amountOut + totalAmountIn;
      }
    }
  }

  const { priceImpact } = calculateSwap(
    poolBuyTokenReserve,
    poolSellTokenReserve,
    remainingAmountOut,
  );

  return {
    ordersToFill,
    bestAmountOut,
    newPriceImpact: priceImpact,
  };
};

export const calculateSwap = (
  poolBuyTokenReserve: number,
  poolSellTokenReserve: number,
  sellAmount: number,
) => {
  const amountInWithFee = sellAmount * 997;

  const numerator = poolBuyTokenReserve * poolSellTokenReserve * 1000;
  const denominator = poolSellTokenReserve * 1000 + amountInWithFee;
  const amountOut = poolBuyTokenReserve - numerator / denominator;

  const price = (amountOut / sellAmount).toFixed(2);
  const priceImpact = (amountOut / poolBuyTokenReserve) * 100;

  return {
    amountOut,
    price,
    priceImpact,
  };
};
