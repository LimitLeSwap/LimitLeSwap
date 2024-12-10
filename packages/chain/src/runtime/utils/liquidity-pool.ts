import { Balance, TokenId, UInt64 } from "@proto-kit/library";
import { Field, Poseidon, PublicKey, Struct } from "o1js";

export class LiquidityPool extends Struct({
    tokenA: TokenId,
    tokenB: TokenId,
    tokenAmountA: Balance,
    tokenAmountB: Balance,
    fee: UInt64,
}) {
    public static from(
        tokenA: TokenId,
        tokenB: TokenId,
        tokenAmountA: Balance,
        tokenAmountB: Balance,
        fee: UInt64
    ) {
        return new LiquidityPool({
            tokenA,
            tokenB,
            tokenAmountA,
            tokenAmountB,
            fee,
        });
    }

    public static calculatePoolId(tokenA: TokenId, tokenB: TokenId) {
        return Poseidon.hash([tokenA, tokenB]);
    }

    public getPoolId() {
        return PublicKey.fromGroup(Poseidon.hashToGroup([this.tokenA, this.tokenB]));
    }
}
