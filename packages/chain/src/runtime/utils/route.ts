import { Field, Provable, Struct } from "o1js";
import { OrderBundle } from "./limit-order";
import { Balance, TokenId } from "@proto-kit/library";

export const MAX_ROUTE_SIZE = 5;
export class Route extends Struct({
    path: Provable.Array(Field, MAX_ROUTE_SIZE),
}) {
    public static empty(): Route {
        const path = Array<Field>(10).fill(Field.from(0));
        return new Route({ path });
    }
}

export class Step extends Struct({
    tokenIn: TokenId,
    tokenOut: TokenId,
    amountIn: Balance,
    amountOut: Balance,
    limitOrders: OrderBundle,
}) {
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
