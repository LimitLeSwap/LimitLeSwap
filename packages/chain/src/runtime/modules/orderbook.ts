import { runtimeMethod, RuntimeModule, runtimeModule, state } from "@proto-kit/module";
import { inject } from "tsyringe";
import { Balances } from "./balances";
import { assert, State, StateMap } from "@proto-kit/protocol";
import { TokenId } from "@proto-kit/library";
import { Bool, Field, UInt64 as o1ui64, Provable } from "o1js";
import { LimitOrder } from "../utils/limit-order";
import { UserCaptivedTokenKey } from "../utils/user-captived-token-key";

interface OrderBookConfig {}

/**
 * OrderBook module
 * @value orderNonce - The nonce of the last order
 * @value orders - The orders in the order book
 */
@runtimeModule()
export class OrderBook extends RuntimeModule<OrderBookConfig> {
    @state() public orderNonce = State.from<Field>(Field);
    @state() public orders = StateMap.from<Field, LimitOrder>(Field, LimitOrder);

    public constructor(@inject("Balances") private balances: Balances) {
        super();
    }

    /**
     * Creates a limit order
     * @param tokenIn TokenId of the token to be traded
     * @param tokenOut TokenId of the token to receive
     * @param tokenInAmount amount of tokenIn
     * @param tokenOutAmount amount of tokenOut
     * @param expiration timeout of the order in blocks
     */
    @runtimeMethod()
    public async createLimitOrder(
        tokenIn: TokenId,
        tokenOut: TokenId,
        tokenInAmount: Field,
        tokenOutAmount: Field,
        expiration: o1ui64
    ): Promise<void> {
        const sender = this.transaction.sender.value;
        const senderBalance = await this.balances.getBalance(tokenIn, sender);
        const captivedAmount = await this.balances.userCaptivedAmount.get(
            UserCaptivedTokenKey.from(tokenIn, sender)
        );
        const senderAvailableBalance = senderBalance.value.sub(captivedAmount.value);
        const currentBlock = this.network.block.height;
        const expirationBlock = expiration.add(currentBlock);

        assert(tokenInAmount.greaterThan(0), "Amount must be greater than 0");

        assert(
            senderAvailableBalance.greaterThanOrEqual(tokenInAmount),
            "Insufficient balance to create limit order"
        );

        const nonce = await this.orderNonce.get();

        const order = LimitOrder.from(
            tokenIn,
            tokenOut,
            tokenInAmount,
            tokenOutAmount,
            sender,
            expirationBlock
        );

        const newCaptivedAmount = captivedAmount.value.add(tokenInAmount);

        await this.orders.set(nonce.value, order);
        await this.orderNonce.set(nonce.value.add(1));

        await this.balances.userCaptivedAmount.set(
            UserCaptivedTokenKey.from(tokenIn, sender),
            newCaptivedAmount
        );
    }

    /**
     * Cancels a limit order
     * @param orderId id of the order to cancel
     * only the owner can cancel the order
     */
    @runtimeMethod()
    public async cancelLimitOrder(orderId: Field) {
        const sender = this.transaction.sender.value;
        const order = await this.orders.get(orderId);
        assert(order.value.owner.equals(sender), "Only the owner can cancel the order");
        assert(order.value.isActive, "Order is already canceled");

        const captivedAmount = await this.balances.userCaptivedAmount.get(
            UserCaptivedTokenKey.from(order.value.tokenIn, sender)
        );
        const newCaptivedAmount = captivedAmount.value.add(order.value.tokenInAmount);

        await this.balances.userCaptivedAmount.set(
            UserCaptivedTokenKey.from(order.value.tokenIn, sender),
            newCaptivedAmount
        );

        order.value.isActive = Bool(false);

        await this.orders.set(orderId, order.value);
    }
}
