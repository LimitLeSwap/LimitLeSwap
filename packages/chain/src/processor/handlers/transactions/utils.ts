import { BlockHandler } from "@proto-kit/processor";
import { Prisma, PrismaClient } from "@prisma/client-processor";
import { Balance, TokenId } from "@proto-kit/library";
import { Poseidon } from "o1js";

export const FEE_TIERS = [1, 5, 30, 100];

export const calculatePoolId = (tokenA: TokenId, tokenB: TokenId) => {
    const smallerTokenId = tokenA.toBigInt() < tokenB.toBigInt() ? tokenA : tokenB;
    const largerTokenId = tokenA.toBigInt() < tokenB.toBigInt() ? tokenB : tokenA;

    return Poseidon.hash([smallerTokenId, largerTokenId]);
};

export const getToken0AndToken1 = (
    tokenA: TokenId,
    tokenB: TokenId,
    tokenAmountA: Balance,
    tokenAmountB: Balance
) => {
    const token0Id = tokenA.toBigInt() < tokenB.toBigInt() ? tokenA : tokenB;
    const token1Id = tokenA.toBigInt() < tokenB.toBigInt() ? tokenB : tokenA;

    const token0Amount =
        tokenA.toBigInt() < tokenB.toBigInt() ? tokenAmountA.toBigInt() : tokenAmountB.toBigInt();
    const token1Amount =
        tokenA.toBigInt() < tokenB.toBigInt() ? tokenAmountB.toBigInt() : tokenAmountA.toBigInt();

    return { token0Id, token1Id, token0Amount, token1Amount };
};

export const getToken0AndToken1WithPrices = (
    tokenA: TokenId,
    tokenB: TokenId,
    tokenAmountA: Balance,
    tokenAmountB: Balance
) => {
    const token0Id = tokenA.toBigInt() < tokenB.toBigInt() ? tokenA : tokenB;
    const token1Id = tokenA.toBigInt() < tokenB.toBigInt() ? tokenB : tokenA;

    const token0Amount = tokenA.toBigInt() < tokenB.toBigInt() ? tokenAmountA : tokenAmountB;

    const token1Amount = tokenA.toBigInt() < tokenB.toBigInt() ? tokenAmountB : tokenAmountA;

    const token0Price = new Prisma.Decimal(token0Amount.toString()).div(token1Amount.toString());
    const token1Price = new Prisma.Decimal(token1Amount.toString()).div(token0Amount.toString());

    return {
        token0Id: token0Id.toString(),
        token1Id: token1Id.toString(),
        token0Amount: token0Amount.toBigInt(),
        token1Amount: token1Amount.toBigInt(),
        token0Price,
        token1Price,
    };
};

export const updatePriceCandle = async (
    client: Parameters<BlockHandler<PrismaClient>>[0],
    poolId: string,
    tokenIn: TokenId,
    tokenOut: TokenId,
    tokenInAmount: Balance,
    tokenOutAmount: Balance,
    blockHeight: number
) => {
    const candleId = `${poolId}-${blockHeight}`;

    const { token0Id, token1Id, token0Amount, token1Amount, token0Price, token1Price } =
        getToken0AndToken1WithPrices(tokenIn, tokenOut, tokenInAmount, tokenOutAmount);

    const existingCandle = await client.blockCandle.findUnique({
        where: { id: candleId },
    });

    if (!existingCandle) {
        await client.blockCandle.create({
            data: {
                id: candleId,
                blockHeight,
                poolId,

                token0Id,
                token1Id,

                openT0: token0Price,
                highT0: token0Price,
                lowT0: token0Price,
                closeT0: token0Price,
                volumeT0: token0Amount,

                openT1: token1Price,
                highT1: token1Price,
                lowT1: token1Price,
                closeT1: token1Price,
                volumeT1: token1Amount,
            },
        });
    } else {
        const highT0 = Prisma.Decimal.max(existingCandle.highT0, token0Price);
        const lowT0 = Prisma.Decimal.min(existingCandle.lowT0, token0Price);
        const closeT0 = token0Price;
        const volumeT0 = existingCandle.volumeT0 + token0Amount;

        const highT1 = Prisma.Decimal.max(existingCandle.highT1, token1Price);
        const lowT1 = Prisma.Decimal.min(existingCandle.lowT1, token1Price);
        const closeT1 = token1Price;
        const volumeT1 = existingCandle.volumeT1 + token1Amount;

        await client.blockCandle.update({
            where: { id: candleId },
            data: {
                highT0,
                lowT0,
                closeT0,
                volumeT0,
                highT1,
                lowT1,
                closeT1,
                volumeT1,
            },
        });
    }
};

export const handleSwapPrisma = async (
    client: Parameters<BlockHandler<PrismaClient>>[0],
    swapId: string,
    poolId: string,
    owner: string,
    tokenIn: TokenId,
    tokenOut: TokenId,
    tokenInAmount: Balance,
    tokenOutAmount: Balance,
    blockHeight: number
) => {
    const { token0Id, token1Id, token0Amount, token1Amount, token0Price, token1Price } =
        getToken0AndToken1WithPrices(tokenIn, tokenOut, tokenInAmount, tokenOutAmount);

    const token0In1Out = tokenIn.toString() === token0Id;

    await client.swap.create({
        data: {
            swapId,
            poolId,
            // token0Id: token0Id.toString(),
            // token1Id: token1Id.toString(),
            token0Amount,
            token1Amount,
            token0In1Out,
            token0Price,
            token1Price,
            blockHeight,
            owner,
        },
    });

    if (token0In1Out) {
        await client.pool.update({
            where: {
                poolId,
            },
            data: {
                token0Amount: {
                    increment: tokenInAmount.toBigInt(),
                },
                token1Amount: {
                    decrement: tokenOutAmount.toBigInt(),
                },
            },
        });
    } else {
        await client.pool.update({
            where: {
                poolId,
            },
            data: {
                token0Amount: {
                    decrement: tokenOutAmount.toBigInt(),
                },
                token1Amount: {
                    increment: tokenInAmount.toBigInt(),
                },
            },
        });
    }

    await client.balance.update({
        where: {
            height_address_tokenId: {
                height: blockHeight,
                address: owner,
                tokenId: tokenIn.toString(),
            },
        },
        data: {
            amount: {
                decrement: tokenInAmount.toBigInt(),
            },
        },
    });

    await client.balance.update({
        where: {
            height_address_tokenId: {
                height: blockHeight,
                address: owner,
                tokenId: tokenOut.toString(),
            },
        },
        data: {
            amount: {
                increment: tokenOutAmount.toBigInt(),
            },
        },
    });

    await updatePriceCandle(
        client,
        poolId,
        tokenIn,
        tokenOut,
        tokenInAmount,
        tokenOutAmount,
        blockHeight
    );
};

export const handleExecuteLimitOrderPrisma = async (
    client: Parameters<BlockHandler<PrismaClient>>[0],
    totalTokenIn: Balance,
    totalTokenOut: Balance,
    orderId: string,
    executer: string,
    blockHeight: number
) => {
    const order = await client.limitOrder.findUnique({
        where: {
            orderId,
        },
    });

    if (!order) {
        throw new Error(`Order ${orderId} not found`);
    }

    if (orderId === "0") {
        return;
    }

    const { poolId, token0Amount, token1Amount, token0In1Out, owner, active, expireBlock } = order;

    if (!active || blockHeight > expireBlock) {
        return;
    }

    const pool = await client.pool.findUnique({
        where: {
            poolId,
        },
        select: {
            token0Id: true,
            token1Id: true,
        },
    });

    if (!pool) {
        throw new Error(`Pool ${poolId} not found`);
    }

    const { token0Id, token1Id } = pool;

    const tokenIn = token0In1Out ? token0Id : token1Id;
    const tokenOut = token0In1Out ? token1Id : token0Id;

    const tokenInAmount = token0In1Out ? token0Amount : token1Amount;
    const tokenOutAmount = token0In1Out ? token1Amount : token0Amount;

    await client.limitOrder.update({
        where: {
            orderId,
        },
        data: {
            active: false,
        },
    });

    await client.balance.update({
        where: {
            height_address_tokenId: {
                height: blockHeight,
                address: executer,
                tokenId: tokenIn,
            },
        },
        data: {
            amount: {
                decrement: tokenInAmount,
            },
        },
    });

    await client.balance.update({
        where: {
            height_address_tokenId: {
                height: blockHeight,
                address: executer,
                tokenId: tokenOut,
            },
        },
        data: {
            amount: {
                increment: tokenOutAmount,
            },
        },
    });

    await client.balance.update({
        where: {
            height_address_tokenId: {
                height: blockHeight,
                address: owner,
                tokenId: tokenOut,
            },
        },
        data: {
            amount: {
                decrement: tokenOutAmount,
            },
        },
    });

    await client.balance.update({
        where: {
            height_address_tokenId: {
                height: blockHeight,
                address: owner,
                tokenId: tokenIn,
            },
        },
        data: {
            amount: {
                increment: tokenInAmount,
            },
        },
    });

    await updatePriceCandle(
        client,
        poolId,
        TokenId.from(tokenIn),
        TokenId.from(tokenOut),
        Balance.from(tokenInAmount),
        Balance.from(tokenOutAmount),
        blockHeight
    );

    return {
        remainingTokenIn: totalTokenIn.toBigInt() - tokenInAmount,
        remainingTokenOut: totalTokenOut.toBigInt() - tokenOutAmount,
    };
};
