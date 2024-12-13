import "reflect-metadata";
import { runtimeMethod, RuntimeModule, runtimeModule, state } from "@proto-kit/module";
import { inject } from "tsyringe";
import { Balances } from "./balances";
import { Bool, Field, Provable, PublicKey } from "o1js";
import { assert, State, StateMap } from "@proto-kit/protocol";
import { Balance, TokenId, UInt64 } from "@proto-kit/library";
import { OrderBook } from "./orderbook";
import { OrderBundle } from "../utils/limit-order";
import { LiquidityPool } from "../utils/liquidity-pool";
import { PoolId } from "../utils/pool-id";
import { calculateInitialLPSupply, calculateLPShare, MINIMUM_LIQUIDITY } from "../utils/math";

interface PoolModuleConfig {}

const FEE_TIERS = [Field.from(1), Field.from(5), Field.from(30), Field.from(100)];

@runtimeModule()
export class PoolModule extends RuntimeModule<PoolModuleConfig> {
    @state() public pools = StateMap.from<Field, LiquidityPool>(Field, LiquidityPool);
    @state() public poolIds = StateMap.from<Field, Field>(Field, Field);
    @state() public poolCount = State.from(Field);
    public constructor(
        @inject("Balances") private balances: Balances,
        @inject("OrderBook") private orderBook: OrderBook
    ) {
        super();
    }

    @runtimeMethod()
    public async createPool(
        tokenA: TokenId,
        tokenB: TokenId,
        tokenAmountA: Balance,
        tokenAmountB: Balance,
        sender: PublicKey,
        feeTierIndex: UInt64,
        lpRequestedAmount: Balance
    ) {
        assert(feeTierIndex.lessThan(UInt64.from(FEE_TIERS.length)), "Invalid fee tier");

        const poolId = PoolId.from(tokenA, tokenB);
        const poolIdHash = poolId.getPoolIdHash();
        const poolAccount = poolId.getPoolAccount();

        Provable.asProver(() => {
            console.log("poolIdHash", poolIdHash.toString());
            console.log("poolAccount", poolAccount.toBase58());
        });

        const currentPool = await this.pools.get(poolIdHash);

        assert(currentPool.isSome.not(), "Pool already exists");

        let feeTier = UInt64.Safe.fromField(FEE_TIERS[0]);
        for (let i = 0; i < FEE_TIERS.length; i++) {
            feeTier = UInt64.Safe.fromField(
                Provable.if(feeTierIndex.equals(UInt64.from(i)), FEE_TIERS[i], feeTier.value)
            );
        }

        const pool = LiquidityPool.from(tokenA, tokenB, tokenAmountA, tokenAmountB, feeTier);

        const senderBalanceA = await this.balances.getBalance(tokenA, sender);
        assert(senderBalanceA.greaterThanOrEqual(tokenAmountA));

        const senderBalanceB = await this.balances.getBalance(tokenB, sender);
        assert(senderBalanceB.greaterThanOrEqual(tokenAmountB));

        await this.balances.transfer(tokenA, sender, poolAccount, tokenAmountA);
        await this.balances.transfer(tokenB, sender, poolAccount, tokenAmountB);

        // enable this line to calculate witness on server side
        // const initialLPSupply = calculateInitialLPSupply(tokenAmountA, tokenAmountB);

        assert(
            lpRequestedAmount.greaterThanOrEqual(Balance.from(0)),
            "Requested LP amount must be greater than 0"
        );
        assert(
            lpRequestedAmount
                .mul(lpRequestedAmount)
                .lessThanOrEqual(tokenAmountA.mul(tokenAmountB).sub(MINIMUM_LIQUIDITY)),
            "Requested LP amount is too large"
        );

        await this.balances.mintToken(poolIdHash, this.transaction.sender.value, lpRequestedAmount);
        await this.balances.mintToken(poolIdHash, poolAccount, Balance.from(MINIMUM_LIQUIDITY));
        await this.pools.set(poolIdHash, pool);

        const currentCount = await this.poolCount.get();
        await this.poolIds.set(currentCount.value, poolIdHash);
        await this.poolCount.set(Field.from(currentCount.value.add(1)));
    }

    @runtimeMethod()
    public async addLiquidity(
        tokenA: TokenId,
        tokenB: TokenId,
        tokenAmountA: Balance,
        tokenAmountB: Balance,
        lpRequestedAmount: Balance
    ) {
        const poolId = PoolId.from(tokenA, tokenB);
        const poolIdHash = poolId.getPoolIdHash();
        const poolAccount = poolId.getPoolAccount();

        Provable.asProver(() => {
            console.log("poolIdHash", poolIdHash.toString());
            console.log("poolAccount", poolAccount.toBase58());
        });

        const currentPool = await this.pools.get(poolIdHash);
        assert(currentPool.isSome, "Pool does not exist");
        assert(lpRequestedAmount.greaterThan(Balance.from(0)), "LP tokens must be greater than 0");

        const lpTotal = await this.balances.getCirculatingSupply(poolIdHash);

        assert(lpTotal.greaterThan(Balance.from(0)), "Pool is empty");

        const reserveA = await this.balances.getBalance(tokenA, poolAccount);
        const reserveB = await this.balances.getBalance(tokenB, poolAccount);

        // do we need this assertion?
        // assert(tokenAmountA.mul(reserveB).equals(tokenAmountB.mul(reserveA)), "Invalid ratio");

        // enable this line to calculate witness on server side
        // const calculatedLPShare = calculateLPShare( tokenAmountA, tokenAmountB, reserveA, reserveB, lpTotal);
        // assert(calculatedLPShare.greaterThanOrEqual(lpRequestedAmount), "Too much LP requested");

        Provable.asProver(() => {
            console.log("reserveA", reserveA.toString());
            console.log("reserveB", reserveB.toString());
            console.log("tokenAmountA", tokenAmountA.toString());
            console.log("tokenAmountB", tokenAmountB.toString());
            console.log("lpTotal", lpTotal.toString());
            console.log("lpRequestedAmount", lpRequestedAmount.toString());

            console.log("reserveA value", reserveA.value.toString());
            console.log("reserveB value", reserveB.value.toString());
            console.log("tokenAmountA value", tokenAmountA.value.toString());
            console.log("tokenAmountB value", tokenAmountB.value.toString());
            console.log("lpTotal value", lpTotal.value.toString());
            console.log("lpRequestedAmount value", lpRequestedAmount.value.toString());
        });

        const respectToA = Balance.Safe.fromField(
            tokenAmountA.value.mul(lpTotal.value).div(reserveA.value)
        );

        const respectToB = Balance.Safe.fromField(
            tokenAmountB.value.mul(lpTotal.value).div(reserveB.value)
        );

        assert(
            lpRequestedAmount.lessThanOrEqual(respectToA),
            "Invalid LP requested amount respect to A"
        );
        assert(
            lpRequestedAmount.lessThanOrEqual(respectToB),
            "Invalid LP requested amount respect to B"
        );

        await this.balances.transfer(
            tokenA,
            this.transaction.sender.value,
            poolAccount,
            tokenAmountA
        );
        await this.balances.transfer(
            tokenB,
            this.transaction.sender.value,
            poolAccount,
            tokenAmountB
        );
        await this.balances.mintToken(poolIdHash, this.transaction.sender.value, lpRequestedAmount);

        const updatedPool = LiquidityPool.from(
            tokenA,
            tokenB,
            reserveA.add(tokenAmountA),
            reserveB.add(tokenAmountB),
            currentPool.value.fee
        );
        await this.pools.set(poolIdHash, updatedPool);
    }

    @runtimeMethod()
    public async removeLiquidity(
        tokenA: TokenId,
        tokenB: TokenId,
        requestedA: Balance,
        requestedB: Balance,
        lpBurned: Balance
    ) {
        const poolId = PoolId.from(tokenA, tokenB);
        const poolIdHash = poolId.getPoolIdHash();
        const poolAccount = poolId.getPoolAccount();

        const currentPool = await this.pools.get(poolIdHash);
        assert(currentPool.isSome, "Pool does not exist");

        const reserveA = await this.balances.getBalance(tokenA, poolAccount);
        assert(requestedA.lessThanOrEqual(reserveA), "Not enough token A");

        const reserveB = await this.balances.getBalance(tokenB, poolAccount);
        assert(requestedB.lessThanOrEqual(reserveB), "Not enough token B");

        const senderLp = await this.balances.getBalance(poolIdHash, this.transaction.sender.value);
        assert(senderLp.greaterThanOrEqual(lpBurned), "Not enough LP tokens");

        const lpTotal = await this.balances.getCirculatingSupply(poolIdHash);

        assert(
            requestedA.mul(lpTotal).lessThanOrEqual(senderLp.mul(reserveA)),
            "Invalid requested A"
        );
        assert(
            requestedB.mul(lpTotal).lessThanOrEqual(senderLp.mul(reserveB)),
            "Invalid requested B"
        );

        await this.balances.burnToken(poolIdHash, this.transaction.sender.value, lpBurned);
        await this.balances.transfer(
            tokenA,
            poolAccount,
            this.transaction.sender.value,
            requestedA
        );
        await this.balances.transfer(
            tokenB,
            poolAccount,
            this.transaction.sender.value,
            requestedB
        );

        const updatedPool = LiquidityPool.from(
            tokenA,
            tokenB,
            reserveA.sub(requestedA),
            reserveB.sub(requestedB),
            currentPool.value.fee
        );
        await this.pools.set(poolIdHash, updatedPool);
    }

    // Todo inspect this function
    @runtimeMethod()
    private async rawSwap(
        tokenIn: TokenId,
        tokenOut: TokenId,
        amountIn: Balance,
        amountOut: Balance
    ) {
        assert(amountIn.greaterThan(Balance.from(0)), "AmountIn must be greater than 0");
        assert(amountOut.greaterThan(Balance.from(0)), "AmountOut must be greater than 0");

        const poolId = PoolId.from(tokenIn, tokenOut);
        const poolIdHash = poolId.getPoolIdHash();
        const poolAccount = poolId.getPoolAccount();

        const currentPool = await this.pools.get(poolIdHash);
        assert(currentPool.isSome, "Pool does not exist");

        const senderBalance = await this.balances.getBalance(
            tokenIn,
            this.transaction.sender.value
        );
        assert(senderBalance.greaterThanOrEqual(amountIn), "Not enough token to swap");

        let reserveIn = await this.balances.getBalance(tokenIn, poolAccount);
        let reserveOut = await this.balances.getBalance(tokenOut, poolAccount);

        Provable.asProver(() => {
            console.log("reserveIn", reserveIn.toString());
            console.log("reserveOut", reserveOut.toString());
            console.log("amountIn", amountIn.toString());
            console.log("amountOut", amountOut.toString());
        });

        const kPrev = reserveIn.mul(reserveOut);

        Provable.asProver(() => {
            console.log("kPrev", kPrev.toString());
        });

        assert(amountOut.lessThanOrEqual(reserveOut), "Not enough token in pool");

        const feeMultiplier = Balance.from(10000n).sub(currentPool.value.fee);

        Provable.asProver(() => {
            console.log("first way", amountIn.mul(feeMultiplier).div(10000n).add(reserveIn));
            console.log("second way", amountIn.div(10000n).mul(feeMultiplier).add(reserveIn));
        });

        const adjustedReserveIn = amountIn.mul(feeMultiplier).div(10000n).add(reserveIn);
        const adjustedReserveOut = reserveOut.sub(amountOut);

        Provable.asProver(() => {
            console.log("adjustedReserveIn", adjustedReserveIn.toString());
            console.log("adjustedReserveOut", adjustedReserveOut.toString());
        });

        const k = adjustedReserveIn.mul(adjustedReserveOut);

        Provable.asProver(() => {
            console.log("k", k.toString());
            console.log("kPrev", kPrev.toString());
            console.log("k > kPrev", k.greaterThanOrEqual(kPrev).toBoolean());
        });

        assert(k.greaterThanOrEqual(kPrev), "Invalid swap");

        await this.balances.transfer(tokenIn, this.transaction.sender.value, poolAccount, amountIn);
        await this.balances.transfer(
            tokenOut,
            poolAccount,
            this.transaction.sender.value,
            amountOut
        );

        reserveIn = await this.balances.getBalance(tokenIn, poolAccount);
        reserveOut = await this.balances.getBalance(tokenOut, poolAccount);

        const adjustedPool = LiquidityPool.from(
            tokenIn,
            tokenOut,
            reserveIn,
            reserveOut,
            currentPool.value.fee
        );
        await this.pools.set(poolIdHash, adjustedPool);
    }

    @runtimeMethod()
    public async swap(tokenIn: TokenId, tokenOut: TokenId, amountIn: Balance, amountOut: Balance) {
        assert(amountIn.greaterThan(Balance.from(0)), "AmountIn must be greater than 0");
        assert(amountOut.greaterThan(Balance.from(0)), "AmountOut must be greater than 0");

        await this.rawSwap(tokenIn, tokenOut, amountIn, amountOut);
    }

    @runtimeMethod()
    public async swapWithLimit(
        tokenIn: TokenId,
        tokenOut: TokenId,
        amountIn: Balance,
        amountOut: Balance,
        limitOrders: OrderBundle
    ) {
        const poolId = PoolId.from(tokenIn, tokenOut);
        const poolIdHash = poolId.getPoolIdHash();

        const currentPool = await this.pools.get(poolIdHash);
        assert(currentPool.isSome, "Pool does not exist");

        const senderBalance = await this.balances.getBalance(
            tokenIn,
            this.transaction.sender.value
        );
        assert(senderBalance.greaterThanOrEqual(amountIn), "Not enough token to swap");

        let remainingAmountIn = amountIn;
        let limitOrderFills = Balance.from(0);

        for (let i = 0; i < 10; i++) {
            const limitOrderId = limitOrders.bundle[i];
            assert(limitOrderId.greaterThanOrEqual(Field.from(0)), "Invalid limit order id");
            const order = (await this.orderBook.orders.get(limitOrderId)).value;
            let isActive = order.isActive.and(
                order.expiration.greaterThanOrEqual(this.network.block.height)
            );
            Provable.asProver(() => {
                console.log("order", limitOrderId.toString());
                console.log("isActive", isActive.toBoolean());
            });
            assert(order.tokenOut.equals(tokenIn).or(isActive.not()), "Invalid token out");
            assert(order.tokenIn.equals(tokenOut).or(isActive.not()), "Invalid token in");

            Provable.asProver(() => {
                console.log("orderTokenOutAmount", order.tokenOutAmount.toString());
                console.log("orderTokenOutAmount", order.tokenOutAmount.toString());
                console.log("orderTokenInAmount", order.tokenInAmount.toString());
                console.log("orderTokenInAmount", order.tokenInAmount.toString());
            });

            const amountToFill = UInt64.Safe.fromField(
                Provable.if(isActive, order.tokenOutAmount.value, Field.from(0))
            );
            const amountToTake = UInt64.Safe.fromField(
                Provable.if(isActive, order.tokenInAmount.value, Field.from(0))
            );
            remainingAmountIn = Balance.from(remainingAmountIn.sub(amountToFill));
            limitOrderFills = Balance.from(limitOrderFills.add(amountToTake));

            Provable.asProver(() => {
                console.log("amountToFill", amountToFill.toString());
                console.log("amountToTake", amountToTake.toString());
                console.log("remainingAmountIn", remainingAmountIn.toString());
                console.log("limitOrderFills", limitOrderFills.toString());
            });
            await this.balances.transfer(
                tokenIn,
                this.transaction.sender.value,
                order.owner,
                Balance.from(amountToFill)
            );
            await this.balances.transfer(
                tokenOut,
                order.owner,
                this.transaction.sender.value,
                Balance.from(amountToTake)
            );
            order.isActive = Bool(false);
            await this.orderBook.orders.set(limitOrderId, order);
        }
        const remainingAmountOut = amountOut.sub(limitOrderFills);
        Provable.asProver(() => {
            console.log("final remainingAmountIn", remainingAmountIn.toString());
            console.log("final remainingAmountOut", remainingAmountOut.toString());
        });
        await this.rawSwap(tokenIn, tokenOut, remainingAmountIn, remainingAmountOut);
    }
}
