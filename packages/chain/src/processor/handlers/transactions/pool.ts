import { BlockHandler } from "@proto-kit/processor";
import { PrismaClient } from "@prisma/client-processor";
import { appChain } from "../../utils/app-chain";
import { MethodParameterEncoder } from "@proto-kit/module";
import { Block, TransactionExecutionResult } from "@proto-kit/sequencer";
import { Balance, TokenId, UInt64 } from "@proto-kit/library";
import { PublicKey } from "o1js";
import {
    calculatePoolId,
    FEE_TIERS,
    getToken0AndToken1,
    handleExecuteLimitOrderPrisma,
    handleSwapPrisma,
} from "./utils";
import { OrderBundle } from "../../../runtime/utils/limit-order";

export const handlePoolCreatePool = async (
    client: Parameters<BlockHandler<PrismaClient>>[0],
    block: Block,
    tx: TransactionExecutionResult
) => {
    const module = appChain.runtime.resolve("PoolModule");

    const parameterDecoder = MethodParameterEncoder.fromMethod(module, "createPool");

    // @ts-expect-error
    const [tokenA, tokenB, tokenAmountA, tokenAmountB, sender, feeTierIndex, lpRequestedAmount]: [
        TokenId,
        TokenId,
        Balance,
        Balance,
        PublicKey,
        UInt64,
        Balance,
    ] = await parameterDecoder.decode(tx.tx.argsFields, tx.tx.auxiliaryData);

    const { token0Id, token1Id, token0Amount, token1Amount } = getToken0AndToken1(
        tokenA,
        tokenB,
        tokenAmountA,
        tokenAmountB
    );

    const poolId = calculatePoolId(tokenA, tokenB);

    const feeTier = FEE_TIERS[Number(feeTierIndex.toString())];

    const lpAmount = lpRequestedAmount.toBigInt();

    await client.pool.create({
        data: {
            poolId: poolId.toString(),
            token0Id: token0Id.toString(),
            token1Id: token1Id.toString(),
            token0Amount,
            token1Amount,
            feePercentage: feeTier,
            totalLpAmount: lpAmount,
            createdAt: new Date(),
        },
    });

    console.log(`Pool created with poolId: ${poolId}`);
    console.table({
        poolId: poolId.toString(),
        token0Id: token0Id.toString(),
        token1Id: token1Id.toString(),
        token0Amount,
        token1Amount,
        feePercentage: feeTier,
        totalLpAmount: lpAmount,
    });

    await client.balance.update({
        where: {
            height_address_tokenId: {
                height: Number(block.height.toString()),
                address: sender.toBase58(),
                tokenId: token0Id.toString(),
            },
        },
        data: {
            amount: {
                decrement: token0Amount,
            },
        },
    });

    await client.balance.update({
        where: {
            height_address_tokenId: {
                height: Number(block.height.toString()),
                address: sender.toBase58(),
                tokenId: token1Id.toString(),
            },
        },
        data: {
            amount: {
                decrement: token1Amount,
            },
        },
    });

    await client.balance.create({
        data: {
            height: Number(block.height.toString()),
            address: sender.toBase58(),
            tokenId: poolId.toString(),
            amount: lpAmount,
        },
    });
};

export const handlePoolAddLiquidity = async (
    client: Parameters<BlockHandler<PrismaClient>>[0],
    block: Block,
    tx: TransactionExecutionResult
) => {
    const module = appChain.runtime.resolve("PoolModule");

    const parameterDecoder = MethodParameterEncoder.fromMethod(module, "addLiquidity");

    // @ts-expect-error
    const [tokenA, tokenB, tokenAmountA, tokenAmountB, lpRequestedAmount]: [
        TokenId,
        TokenId,
        Balance,
        Balance,
        Balance,
    ] = await parameterDecoder.decode(tx.tx.argsFields, tx.tx.auxiliaryData);

    const { token0Id, token1Id, token0Amount, token1Amount } = getToken0AndToken1(
        tokenA,
        tokenB,
        tokenAmountA,
        tokenAmountB
    );

    const poolId = calculatePoolId(tokenA, tokenB);

    const lpAmount = lpRequestedAmount.toBigInt();

    await client.pool.update({
        where: {
            poolId: poolId.toString(),
        },
        data: {
            token0Amount: {
                increment: token0Amount,
            },
            token1Amount: {
                increment: token1Amount,
            },
            totalLpAmount: {
                increment: lpAmount,
            },
        },
    });

    console.log(`Liquidity added to pool with poolId: ${poolId}`);
    console.table({
        poolId: poolId.toString(),
        token0Id: token0Id.toString(),
        token1Id: token1Id.toString(),
        token0Amount,
        token1Amount,
        totalLpAmount: lpAmount,
    });

    await client.balance.update({
        where: {
            height_address_tokenId: {
                height: Number(block.height.toString()),
                address: tx.tx.sender.toBase58(),
                tokenId: token0Id.toString(),
            },
        },
        data: {
            amount: {
                decrement: token0Amount,
            },
        },
    });

    await client.balance.update({
        where: {
            height_address_tokenId: {
                height: Number(block.height.toString()),
                address: tx.tx.sender.toBase58(),
                tokenId: token1Id.toString(),
            },
        },
        data: {
            amount: {
                decrement: token1Amount,
            },
        },
    });

    await client.balance.update({
        where: {
            height_address_tokenId: {
                height: Number(block.height.toString()),
                address: tx.tx.sender.toBase58(),
                tokenId: poolId.toString(),
            },
        },
        data: {
            amount: {
                increment: lpAmount,
            },
        },
    });
};

export const handlePoolRemoveLiquidity = async (
    client: Parameters<BlockHandler<PrismaClient>>[0],
    block: Block,
    tx: TransactionExecutionResult
) => {
    const module = appChain.runtime.resolve("PoolModule");

    const parameterDecoder = MethodParameterEncoder.fromMethod(module, "removeLiquidity");

    // @ts-expect-error
    const [tokenA, tokenB, requestedA, requestedB, lpBurned]: [
        TokenId,
        TokenId,
        Balance,
        Balance,
        Balance,
    ] = await parameterDecoder.decode(tx.tx.argsFields, tx.tx.auxiliaryData);

    const { token0Id, token1Id, token0Amount, token1Amount } = getToken0AndToken1(
        tokenA,
        tokenB,
        requestedA,
        requestedB
    );

    const poolId = calculatePoolId(tokenA, tokenB);

    const lpAmount = lpBurned.toBigInt();

    await client.pool.update({
        where: {
            poolId: poolId.toString(),
        },
        data: {
            token0Amount: {
                decrement: token0Amount,
            },
            token1Amount: {
                decrement: token1Amount,
            },
            totalLpAmount: {
                decrement: lpAmount,
            },
        },
    });

    console.log(`Liquidity removed from pool with poolId: ${poolId}`);
    console.table({
        poolId: poolId.toString(),
        token0Id: token0Id.toString(),
        token1Id: token1Id.toString(),
        token0Amount,
        token1Amount,
        totalLpAmount: lpAmount,
    });

    await client.balance.update({
        where: {
            height_address_tokenId: {
                height: Number(block.height.toString()),
                address: tx.tx.sender.toBase58(),
                tokenId: token0Id.toString(),
            },
        },
        data: {
            amount: {
                increment: token0Amount,
            },
        },
    });

    await client.balance.update({
        where: {
            height_address_tokenId: {
                height: Number(block.height.toString()),
                address: tx.tx.sender.toBase58(),
                tokenId: token1Id.toString(),
            },
        },
        data: {
            amount: {
                increment: token1Amount,
            },
        },
    });

    await client.balance.update({
        where: {
            height_address_tokenId: {
                height: Number(block.height.toString()),
                address: tx.tx.sender.toBase58(),
                tokenId: poolId.toString(),
            },
        },
        data: {
            amount: {
                decrement: lpAmount,
            },
        },
    });
};

export const handlePoolSwap = async (
    client: Parameters<BlockHandler<PrismaClient>>[0],
    block: Block,
    tx: TransactionExecutionResult
) => {
    const module = appChain.runtime.resolve("PoolModule");

    const parameterDecoder = MethodParameterEncoder.fromMethod(module, "swap");

    // @ts-expect-error
    const [tokenIn, tokenOut, amountIn, amountOut]: [TokenId, TokenId, Balance, Balance] =
        await parameterDecoder.decode(tx.tx.argsFields, tx.tx.auxiliaryData);

    const poolId = calculatePoolId(tokenIn, tokenOut);

    await handleSwapPrisma(
        client,
        tx.tx.hash.toString(),
        poolId.toString(),
        tx.tx.sender.toBase58(),
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        Number(block.height.toString())
    );
};

export const handlePoolSwapWithLimit = async (
    client: Parameters<BlockHandler<PrismaClient>>[0],
    block: Block,
    tx: TransactionExecutionResult
) => {
    const module = appChain.runtime.resolve("PoolModule");

    const parameterDecoder = MethodParameterEncoder.fromMethod(module, "swapWithLimit");

    // @ts-expect-error
    const [tokenIn, tokenOut, amountIn, amountOut, limitOrders]: [
        TokenId,
        TokenId,
        Balance,
        Balance,
        OrderBundle,
    ] = await parameterDecoder.decode(tx.tx.argsFields, tx.tx.auxiliaryData);

    const poolId = calculatePoolId(tokenIn, tokenOut);

    let remainingAmountIn = amountIn;
    let remainingAmountOut = amountOut;

    for (const order of limitOrders.bundle) {
        const result = await handleExecuteLimitOrderPrisma(
            client,
            remainingAmountIn,
            remainingAmountOut,
            order.toString(),
            tx.tx.sender.toBase58(),
            Number(block.height.toString())
        );

        if (result) {
            const { remainingTokenIn, remainingTokenOut } = result;
            remainingAmountIn = Balance.from(remainingTokenIn);
            remainingAmountOut = Balance.from(remainingTokenOut);

            console.log(`Limit order executed: ${order.toString()}`);
            console.table({
                remainingAmountIn: remainingAmountIn.toBigInt(),
                remainingAmountOut: remainingAmountOut.toBigInt(),
            });
        } else {
            console.log("Filler order executed");
        }
    }

    await handleSwapPrisma(
        client,
        tx.tx.hash.toString(),
        poolId.toString(),
        tx.tx.sender.toBase58(),
        tokenIn,
        tokenOut,
        remainingAmountIn,
        remainingAmountOut,
        Number(block.height.toString())
    );

    console.log(`Swap with limit executed`);
};
