import { BlockHandler } from "@proto-kit/processor";
import { PrismaClient } from "@prisma/client-processor";
import { appChain } from "../../utils/app-chain";
import { MethodParameterEncoder } from "@proto-kit/module";
import { Block, TransactionExecutionResult } from "@proto-kit/sequencer";
import { Balance, TokenId } from "@proto-kit/library";
import { PublicKey } from "o1js";

export const decreaseUserBalance = async (
    client: Parameters<BlockHandler<PrismaClient>>[0],
    blockHeight: number,
    tokenId: TokenId,
    address: PublicKey,
    amount: Balance
) => {
    const currentBalance = await client.balance.findFirst({
        where: {
            address: address.toBase58(),
            tokenId: tokenId.toString(),
        },
        orderBy: { height: "desc" },
    });

    if (currentBalance === null) {
        throw new Error(`Balance not found for ${address.toBase58()}`);
    }

    if (BigInt(currentBalance.amount) < amount.toBigInt()) {
        throw new Error(`Insufficient balance for ${address.toBase58()}`);
    }

    if (amount.toBigInt() < 0n) {
        throw new Error(`Invalid amount ${amount.toBigInt()} for ${address.toBase58()}`);
    }

    if (amount.toBigInt() === 0n) {
        return;
    }

    if (currentBalance.height > blockHeight) {
        throw new Error(`Invalid block height ${blockHeight} for ${address.toBase58()}`);
    }

    if (currentBalance.height === blockHeight) {
        await client.balance.update({
            where: {
                height_address_tokenId: {
                    height: currentBalance.height,
                    address: address.toBase58(),
                    tokenId: tokenId.toString(),
                },
            },
            data: {
                amount: BigInt(currentBalance.amount) - amount.toBigInt(),
            },
        });
    } else {
        await client.balance.create({
            data: {
                height: blockHeight,
                tokenId: tokenId.toString(),
                address: address.toBase58(),
                amount: BigInt(currentBalance.amount) - amount.toBigInt(),
            },
        });
    }

    console.log(`Decreased balance for`);
    console.table({
        tokenId: tokenId.toString(),
        address: address.toBase58(),
        fromAmount: BigInt(currentBalance.amount),
        toAmount: BigInt(currentBalance.amount) - amount.toBigInt(),
    });
};

export const increaseUserBalance = async (
    client: Parameters<BlockHandler<PrismaClient>>[0],
    blockHeight: number,
    tokenId: TokenId,
    address: PublicKey,
    amount: Balance
) => {
    const currentBalance = await client.balance.findFirst({
        where: {
            address: address.toBase58(),
            tokenId: tokenId.toString(),
        },
        orderBy: { height: "desc" },
    });

    if (currentBalance === null) {
        await client.balance.create({
            data: {
                height: blockHeight,
                tokenId: tokenId.toString(),
                address: address.toBase58(),
                amount: amount.toBigInt(),
            },
        });
    } else {
        if (BigInt(currentBalance.amount) < 0n) {
            throw new Error(`Invalid balance for ${address.toBase58()}`);
        }

        if (amount.toBigInt() < 0n) {
            throw new Error(`Invalid amount ${amount.toBigInt()} for ${address.toBase58()}`);
        }

        if (amount.toBigInt() === 0n) {
            return;
        }

        if (currentBalance.height > blockHeight) {
            throw new Error(`Invalid block height ${blockHeight} for ${address.toBase58()}`);
        }

        if (currentBalance.height === blockHeight) {
            await client.balance.update({
                where: {
                    height_address_tokenId: {
                        height: currentBalance.height,
                        address: address.toBase58(),
                        tokenId: tokenId.toString(),
                    },
                },
                data: {
                    amount: BigInt(currentBalance.amount) + amount.toBigInt(),
                },
            });
        } else {
            await client.balance.create({
                data: {
                    height: blockHeight,
                    tokenId: tokenId.toString(),
                    address: address.toBase58(),
                    amount: BigInt(currentBalance.amount) + amount.toBigInt(),
                },
            });
        }
    }
};

export const handleBalancesMintToken = async (
    client: Parameters<BlockHandler<PrismaClient>>[0],
    block: Block,
    tx: TransactionExecutionResult
) => {
    const module = appChain.runtime.resolve("Balances");

    const parameterDecoder = MethodParameterEncoder.fromMethod(module, "mintToken");

    // @ts-expect-error
    const [tokenId, address, amount]: [TokenId, PublicKey, Balance] = await parameterDecoder.decode(
        tx.tx.argsFields,
        tx.tx.auxiliaryData
    );

    console.log("Decoding mintToken parameters");
    console.table({
        tokenId: tokenId.toString(),
        address: address.toBase58(),
        amount: amount.toBigInt(),
    });

    await increaseUserBalance(client, Number(block.height.toString()), tokenId, address, amount);

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

    // @ts-expect-error
    const [tokenId, address, amount]: [TokenId, PublicKey, Balance] = await parameterDecoder.decode(
        tx.tx.argsFields,
        tx.tx.auxiliaryData
    );

    console.log("Decoding burnToken parameters");
    console.table({
        tokenId: tokenId.toString(),
        address: address.toBase58(),
        amount: amount.toBigInt(),
    });

    await decreaseUserBalance(client, Number(block.height.toString()), tokenId, address, amount);

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

    // @ts-expect-error
    const [tokenId]: [TokenId] = await parameterDecoder.decode(
        tx.tx.argsFields,
        tx.tx.auxiliaryData
    );

    console.log("Decoding createToken parameters");
    console.table({
        tokenId: tokenId.toString(),
    });

    await client.token.create({
        data: {
            tokenId: tokenId.toString(),
            decimals: 6,
            totalSupply: 0n,
        },
    });

    console.log(`Token ${tokenId.toString()} created`);
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

    await decreaseUserBalance(client, Number(block.height.toString()), tokenId, from, amount);
    await increaseUserBalance(client, Number(block.height.toString()), tokenId, to, amount);
};
