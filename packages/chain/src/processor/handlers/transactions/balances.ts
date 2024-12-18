import { BlockHandler } from "@proto-kit/processor";
import { PrismaClient } from "@prisma/client-processor";
import { appChain } from "../../utils/app-chain";
import { MethodParameterEncoder } from "@proto-kit/module";
import { Block, TransactionExecutionResult } from "@proto-kit/sequencer";
import { Balance, TokenId } from "@proto-kit/library";
import { PublicKey } from "o1js";

export const handleBalancesMintToken = async (
    client: Parameters<BlockHandler<PrismaClient>>[0],
    block: Block,
    tx: TransactionExecutionResult
) => {
    const module = appChain.runtime.resolve("Balances");

    const parameterDecoder = MethodParameterEncoder.fromMethod(module, "mintToken");

    console.log("Decoding mintToken parameters");
    // @ts-expect-error
    const [tokenId, address, amount]: [TokenId, PublicKey, Balance] = await parameterDecoder.decode(
        tx.tx.argsFields,
        tx.tx.auxiliaryData
    );

    const currentBalance = await client.balance.findFirst({
        where: {
            address: address.toBase58(),
            tokenId: tokenId.toString(),
        },
        orderBy: { height: "desc" },
    });

    const previousAmount = currentBalance ? BigInt(currentBalance.amount) : 0n;
    const newAmount = previousAmount + amount.toBigInt();

    await client.balance.create({
        data: {
            height: Number(block.height.toString()),
            tokenId: tokenId.toString(),
            address: address.toBase58(),
            amount: newAmount,
        },
    });

    const currentToken = await client.token.findFirst({
        where: {
            tokenId: tokenId.toString(),
        },
    });

    if (!currentToken) {
        throw new Error(`Token ${tokenId.toString()} not found`);
    }
    const previousTotalSupply = BigInt(currentToken.totalSupply);

    await client.token.update({
        where: {
            tokenId: tokenId.toString(),
        },
        data: {
            totalSupply: previousTotalSupply + amount.toBigInt(),
        },
    });
};

export const handleBalancesBurnToken = async (
    client: Parameters<BlockHandler<PrismaClient>>[0],
    block: Block,
    tx: TransactionExecutionResult
) => {
    const module = appChain.runtime.resolve("Balances");

    const parameterDecoder = MethodParameterEncoder.fromMethod(module, "burnToken");

    console.log("Decoding burnToken parameters");
    // @ts-expect-error
    const [tokenId, address, amount]: [TokenId, PublicKey, Balance] = await parameterDecoder.decode(
        tx.tx.argsFields,
        tx.tx.auxiliaryData
    );

    const currentBalance = await client.balance.findFirst({
        where: {
            address: address.toBase58(),
            tokenId: tokenId.toString(),
        },
        orderBy: { height: "desc" },
    });

    const previousAmount = currentBalance ? BigInt(currentBalance.amount) : 0n;
    const newAmount = previousAmount - amount.toBigInt();

    await client.balance.create({
        data: {
            height: Number(block.height.toString()),
            tokenId: tokenId.toString(),
            address: address.toBase58(),
            amount: newAmount,
        },
    });

    const currentToken = await client.token.findFirst({
        where: {
            tokenId: tokenId.toString(),
        },
    });

    if (!currentToken) {
        throw new Error(`Token ${tokenId.toString()} not found`);
    }

    const previousTotalSupply = BigInt(currentToken.totalSupply);

    await client.token.update({
        where: {
            tokenId: tokenId.toString(),
        },
        data: {
            totalSupply: previousTotalSupply - amount.toBigInt(),
        },
    });
};

export const handleBalancesCreateToken = async (
    client: Parameters<BlockHandler<PrismaClient>>[0],
    block: Block,
    tx: TransactionExecutionResult
) => {
    const module = appChain.runtime.resolve("Balances");

    const parameterDecoder = MethodParameterEncoder.fromMethod(module, "createToken");

    console.log("Decoding createToken parameters");
    // @ts-expect-error
    const [tokenId]: [TokenId] = await parameterDecoder.decode(
        tx.tx.argsFields,
        tx.tx.auxiliaryData
    );

    await client.token.create({
        data: {
            tokenId: tokenId.toString(),
            decimals: 6,
            totalSupply: 0n,
        },
    });
};

export const handleBalancesSafeTransfer = async (
    client: Parameters<BlockHandler<PrismaClient>>[0],
    block: Block,
    tx: TransactionExecutionResult
) => {
    const module = appChain.runtime.resolve("Balances");

    const parameterDecoder = MethodParameterEncoder.fromMethod(module, "safeTransfer");

    console.log("Decoding safeTransfer parameters");
    // @ts-expect-error
    const [tokenId, from, to, amount]: [TokenId, PublicKey, PublicKey, Balance] =
        await parameterDecoder.decode(tx.tx.argsFields, tx.tx.auxiliaryData);

    const currentFromBalance = await client.balance.findFirst({
        where: {
            address: from.toBase58(),
            tokenId: tokenId.toString(),
        },
        orderBy: { height: "desc" },
    });

    const previousFromAmount = currentFromBalance ? BigInt(currentFromBalance.amount) : 0n;
    const newFromAmount = previousFromAmount - amount.toBigInt();

    await client.balance.create({
        data: {
            height: Number(block.height.toString()),
            tokenId: tokenId.toString(),
            address: from.toBase58(),
            amount: newFromAmount,
        },
    });

    const currentToBalance = await client.balance.findFirst({
        where: {
            address: to.toBase58(),
            tokenId: tokenId.toString(),
        },
        orderBy: { height: "desc" },
    });

    const previousToAmount = currentToBalance ? BigInt(currentToBalance.amount) : 0n;
    const newToAmount = previousToAmount + amount.toBigInt();

    await client.balance.create({
        data: {
            height: Number(block.height.toString()),
            tokenId: tokenId.toString(),
            address: to.toBase58(),
            amount: newToAmount,
        },
    });
};
