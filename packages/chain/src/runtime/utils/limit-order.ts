import { TokenId } from "@proto-kit/library";
import { Bool, Field, Provable, PublicKey, Struct, UInt64 as o1ui64 } from "o1js";

export const MAX_ORDER_SIZE = 10;

export class OrderBundle extends Struct({
    bundle: Provable.Array(Field, MAX_ORDER_SIZE),
}) {
    public static empty(): OrderBundle {
        const bundle = Array<Field>(10).fill(Field.from(0));
        return new OrderBundle({ bundle });
    }
}

export class LimitOrder extends Struct({
    tokenIn: TokenId,
    tokenOut: TokenId,
    tokenInAmount: Field,
    tokenOutAmount: Field,
    owner: PublicKey,
    expiration: o1ui64,
    isActive: Bool,
}) {
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
