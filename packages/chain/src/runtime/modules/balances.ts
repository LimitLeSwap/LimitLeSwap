import { runtimeMethod, runtimeModule, state } from "@proto-kit/module";
import { assert, State, StateMap } from "@proto-kit/protocol";
import { Balance, Balances as BaseBalances, TokenId, UInt64 } from "@proto-kit/library";
import { Field, PublicKey } from "o1js";
import { UserCaptivedTokenKey } from "../utils/user-captived-token-key";

interface BalancesConfig {}

@runtimeModule()
export class Balances extends BaseBalances<BalancesConfig> {
    @state() public tokens = StateMap.from<Field, TokenId>(Field, TokenId);
    @state() public tokenCount = State.from(Field);
    @state() public circulatingSupply = StateMap.from<TokenId, Balance>(TokenId, Balance);
    @state() public userCaptivedAmount = StateMap.from<UserCaptivedTokenKey, Balance>(
        UserCaptivedTokenKey,
        Balance
    );

    @runtimeMethod()
    public async getCirculatingSupply(tokenId: TokenId): Promise<Balance> {
        const circulatingSupply = await this.circulatingSupply.get(tokenId);
        return Balance.from(circulatingSupply.value);
    }

    @runtimeMethod()
    public async createToken(tokenId: TokenId): Promise<void> {
        const currentCount = await this.tokenCount.get();
        await this.tokens.set(currentCount.value, tokenId);
        await this.tokenCount.set(Field.from(currentCount.value.add(1)));
        await this.circulatingSupply.set(tokenId, Balance.from(0));
    }

    @runtimeMethod()
    public async mintToken(tokenId: TokenId, address: PublicKey, amount: Balance): Promise<void> {
        const circulatingSupply = await this.circulatingSupply.get(tokenId);
        const newCirculatingSupply = Balance.from(circulatingSupply.value).add(amount);

        await this.circulatingSupply.set(tokenId, newCirculatingSupply);
        await this.mint(tokenId, address, amount);
    }

    @runtimeMethod()
    public async burnToken(tokenId: TokenId, address: PublicKey, amount: Balance): Promise<void> {
        const circulatingSupply = await this.circulatingSupply.get(tokenId);
        const newCirculatingSupply = Balance.from(circulatingSupply.value).sub(amount);

        await this.circulatingSupply.set(tokenId, newCirculatingSupply);
        await this.burn(tokenId, address, amount);
    }

    @runtimeMethod()
    public async safeTransfer(
        tokenId: TokenId,
        from: PublicKey,
        to: PublicKey,
        amount: Balance
    ): Promise<void> {
        const senderBalance = await this.getBalance(tokenId, from);
        const senderCaptivedAmount = await this.userCaptivedAmount.get(
            UserCaptivedTokenKey.from(tokenId, from)
        );
        const senderFreeBalance = senderBalance.sub(
            UInt64.Safe.fromField(senderCaptivedAmount.value.value)
        );
        assert(senderFreeBalance.greaterThanOrEqual(amount), "Insufficient balance");

        assert(from.equals(to).not(), "Cannot transfer to self");

        await this.transfer(tokenId, from, to, amount);
    }
}
