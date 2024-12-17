import { TokenId } from "@proto-kit/library";
import { assert } from "@proto-kit/protocol";
import { Field, Poseidon, Provable, PublicKey, Struct } from "o1js";

/**
 * PoolId is a unique identifier for a pool.
 * @method from Creates a PoolId object from two token ids.
 * @method getPoolId Returns the pool id.
 */
export class PoolId extends Struct({
    token0: TokenId,
    token1: TokenId,
}) {
    /**
     * Creates a PoolId object from two token ids.
     * @param token0 The first token in the pool.
     * @param token1 The second token in the pool.
     * @returns A PoolId object.
     * @throws If the tokens are the same.
     */
    public static from(token0: TokenId, token1: TokenId): PoolId {
        assert(token0.equals(token1).not(), "Tokens must be different");
        const smallerTokenId = Provable.if(token0.lessThan(token1), token0, token1);
        const largerTokenId = Provable.if(token0.lessThan(token1), token1, token0);
        return new PoolId({
            token0: smallerTokenId,
            token1: largerTokenId,
        });
    }

    public static rawFrom(token0: TokenId, token1: TokenId): PoolId {
        const smallerTokenId = Provable.if(token0.lessThan(token1), token0, token1);
        const largerTokenId = Provable.if(token0.lessThan(token1), token1, token0);
        return new PoolId({
            token0: smallerTokenId,
            token1: largerTokenId,
        });
    }

    /**
     * Returns the pool id for the pool object.
     * @returns The pool id.
     */
    public getPoolIdHash(): Field {
        return Poseidon.hash([this.token0, this.token1]);
    }

    public getPoolAccount(): PublicKey {
        const poolId = this.getPoolIdHash();
        return PublicKey.fromGroup(Poseidon.hashToGroup([poolId, this.token0, this.token1]));
    }
}
