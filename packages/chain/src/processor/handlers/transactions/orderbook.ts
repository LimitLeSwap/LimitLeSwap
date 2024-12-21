import { BlockHandler } from "@proto-kit/processor";
import { Prisma, PrismaClient } from "@prisma/client-processor";
import { appChain } from "../../utils/app-chain";
import { MethodParameterEncoder } from "@proto-kit/module";
import { Block, TransactionExecutionResult } from "@proto-kit/sequencer";
import { Balance, TokenId, UInt64 } from "@proto-kit/library";
import { Field, Poseidon, Provable, PublicKey, UInt64 as o1ui64 } from "o1js";

export const handleCreateLimitOrder = async (
    client: Parameters<BlockHandler<PrismaClient>>[0],
    block: Block,
    tx: TransactionExecutionResult
) => {
    const module = appChain.runtime.resolve("OrderBook");

    const parameterDecoder = MethodParameterEncoder.fromMethod(module, "createLimitOrder");

    // @ts-expect-error
    const [tokenIn, tokenOut, tokenInAmount, tokenOutAmount, expiration]: [
        TokenId,
        TokenId,
        Balance,
        Balance,
        o1ui64,
    ] = await parameterDecoder.decode(tx.tx.argsFields, tx.tx.auxiliaryData);

    const tokenInBig = tokenInAmount.toBigInt();
    const tokenOutBig = tokenOutAmount.toBigInt();

    const poolId =
        tokenInBig < tokenOutBig
            ? Poseidon.hash([tokenIn, tokenOut])
            : Poseidon.hash([tokenOut, tokenIn]);

    const token0Price = tokenInBig > 0n ? (tokenOutBig * 10n ** 6n) / tokenInBig : 0n;
    const token1Price = tokenOutBig > 0n ? (tokenInBig * 10n ** 6n) / tokenOutBig : 0n;

    const token0In1Out = tokenInBig < tokenOutBig;

    const sender = tx.tx.sender.toBase58();

    const expirationBlock = Number(expiration.toString());

    const currentNonce = await client.limitOrder.count();

    const newOrder = await client.limitOrder.create({
        data: {
            orderId: currentNonce.toString(),
            poolId: poolId.toString(),
            token0Amount: token0In1Out ? tokenInBig : tokenOutBig,
            token1Amount: token0In1Out ? tokenOutBig : tokenInBig,
            token0Price: new Prisma.Decimal(Number(token0Price / 10n ** 6n)),
            token1Price: new Prisma.Decimal(Number(token1Price / 10n ** 6n)),
            token0In1Out,
            owner: sender,
            active: true,
            expireBlock: expirationBlock,
            createdAt: new Date(),
        },
    });

    console.log(`LimitOrder created with orderId: ${newOrder.orderId}`);
    console.table({
        orderId: newOrder.orderId,
        poolId: newOrder.poolId,
        token0Amount: newOrder.token0Amount,
        token1Amount: newOrder.token1Amount,
        token0Price: newOrder.token0Price,
        token1Price: newOrder.token1Price,
        token0In1Out: newOrder.token0In1Out,
        owner: newOrder.owner,
        active: newOrder.active,
        expireBlock: newOrder.expireBlock,
    });
};

export const handleCancelLimitOrder = async (
    client: Parameters<BlockHandler<PrismaClient>>[0],
    block: Block,
    tx: TransactionExecutionResult
) => {
    const module = appChain.runtime.resolve("OrderBook");

    const parameterDecoder = MethodParameterEncoder.fromMethod(module, "cancelLimitOrder");

    // @ts-expect-error
    const [orderId]: [Field] = await parameterDecoder.decode(tx.tx.argsFields, tx.tx.auxiliaryData);

    const order = await client.limitOrder.findFirst({
        where: {
            orderId: orderId.toString(),
        },
    });

    if (!order) {
        throw new Error(`Order ${orderId.toString()} not found`);
    }

    await client.limitOrder.update({
        where: {
            orderId: orderId.toString(),
        },
        data: {
            active: false,
        },
    });

    console.log(`LimitOrder ${orderId.toString()} canceled`);
};
