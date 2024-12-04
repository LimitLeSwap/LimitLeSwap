import { TokenId } from "@proto-kit/library";
import { assert } from "@proto-kit/protocol";
import { Field, Poseidon, Provable, Struct } from "o1js";

export class PoolId extends Struct({
    token0: TokenId,
    token1: TokenId,
}) {
    public static from(token0: TokenId, token1: TokenId): PoolId {
        assert(token0.equals(token1).not(), "Tokens must be different");
        const smallerTokenId = Provable.if(token0.lessThan(token1), token0, token1);
        const largerTokenId = Provable.if(token0.lessThan(token1), token1, token0);
        return new PoolId({
            token0: smallerTokenId,
            token1: largerTokenId,
        });
    }

    public getPoolId(): Field {
        return Poseidon.hash([this.token0, this.token1]);
    }
}
