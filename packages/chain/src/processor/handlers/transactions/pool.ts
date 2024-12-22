import { BlockHandler } from "@proto-kit/processor";
import { PrismaClient } from "@prisma/client-processor";
import { appChain } from "../../utils/app-chain";
import { MethodParameterEncoder } from "@proto-kit/module";
import { Block, TransactionExecutionResult } from "@proto-kit/sequencer";
import { Balance, TokenId, UInt64 } from "@proto-kit/library";
import { Poseidon, PublicKey } from "o1js";

const FEE_TIERS = [1, 5, 30, 100];

const calculatePoolId = (tokenA: TokenId, tokenB: TokenId) => {
    const smallerTokenId = tokenA.toBigInt() < tokenB.toBigInt() ? tokenA : tokenB;
    const largerTokenId = tokenA.toBigInt() < tokenB.toBigInt() ? tokenB : tokenA;

    return Poseidon.hash([smallerTokenId, largerTokenId]);
};

const getToken0AndToken1 = (
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
