import { TokenId } from "@proto-kit/library";
import { PublicKey, Struct } from "o1js";

/**
 * UserCaptivedTokenKey is a unique identifier for a user's captived token.
 * @method from Creates a UserCaptivedTokenKey object from a token id and an owner.
 */
export class UserCaptivedTokenKey extends Struct({
    tokenId: TokenId,
    owner: PublicKey,
}) {
    /**
     * Creates a UserCaptivedTokenKey object from a token id and an owner.
     * @param tokenId The token id.
     * @param owner The owner of the captived token.
     * @returns A UserCaptivedTokenKey object.
     */
    public static from(tokenId: TokenId, owner: PublicKey) {
        return new UserCaptivedTokenKey({
            tokenId,
            owner,
        });
    }
}
