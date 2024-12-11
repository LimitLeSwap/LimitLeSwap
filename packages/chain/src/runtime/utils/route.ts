import { Field, Provable, Struct } from "o1js";
import { OrderBundle } from "./limit-order";
import { Balance, TokenId } from "@proto-kit/library";

export const MAX_ROUTE_SIZE = 5;

export class Step extends Struct({
    tokenIn: TokenId,
    tokenOut: TokenId,
    amountIn: Balance,
    amountOut: Balance,
    limitOrders: OrderBundle,
}) {
    public static empty(): Step {
        return new Step({
            tokenIn: TokenId.from(0),
            tokenOut: TokenId.from(0),
            amountIn: Balance.from(0),
            amountOut: Balance.from(0),
            limitOrders: OrderBundle.empty(),
        });
    }
    public static from(
        tokenIn: TokenId,
        tokenOut: TokenId,
        amountIn: Balance,
        amountOut: Balance,
        limitOrders: OrderBundle
    ) {
        return new Step({
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            limitOrders,
        });
    }
}

export class Route extends Struct({
    path: Provable.Array(Step, MAX_ROUTE_SIZE),
}) {
    public static empty(): Route {
        const path = Array<Step>(10).fill(Step.empty());
        return new Route({ path });
    }
}
