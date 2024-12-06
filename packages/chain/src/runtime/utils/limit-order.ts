import { TokenId } from "@proto-kit/library";
import { Bool, Field, Provable, PublicKey, Struct, UInt64 as o1ui64 } from "o1js";

export const MAX_ORDER_SIZE = 10;

/**
 * OrderBundle is a bundle of limit orders.
 * @method empty Creates an empty OrderBundle object.
 */
export class OrderBundle extends Struct({
    bundle: Provable.Array(Field, MAX_ORDER_SIZE),
}) {
    /**
     * Creates an empty OrderBundle object.
     * @returns An empty OrderBundle object.
     */
    public static empty(): OrderBundle {
        const bundle = Array<Field>(10).fill(Field.from(0));
        return new OrderBundle({ bundle });
    }
}

/**
 * LimitOrder is a limit order.
 * @method from Creates a LimitOrder object.
 */
export class LimitOrder extends Struct({
    tokenIn: TokenId,
    tokenOut: TokenId,
    tokenInAmount: Field,
    tokenOutAmount: Field,
    owner: PublicKey,
    expiration: o1ui64,
    isActive: Bool,
}) {
    /**
     * Creates a LimitOrder object.
     * @param tokenIn The token to be traded.
     * @param tokenOut The token to receive.
     * @param tokenInAmount The amount of token to be traded.
     * @param tokenOutAmount The amount of token to receive.
     * @param owner The owner of the limit order.
     * @param expiration The expiration block height.
     * @param isActive The status of the limit order.
     * @returns A LimitOrder object.
     */
    public static from(
        tokenIn: TokenId,
        tokenOut: TokenId,
        tokenInAmount: Field,
        tokenOutAmount: Field,
        owner: PublicKey,
        expiration: o1ui64,
        isActive: Bool = Bool(true)
    ) {
        return new LimitOrder({
            tokenIn,
            tokenOut,
            tokenInAmount,
            tokenOutAmount,
            owner,
            expiration,
            isActive,
        });
    }
}
