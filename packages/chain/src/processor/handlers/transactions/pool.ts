import { BlockHandler } from "@proto-kit/processor";
import { PrismaClient } from "@prisma/client-processor";
import { appChain } from "../../utils/app-chain";
import { MethodParameterEncoder } from "@proto-kit/module";
import { Block, TransactionExecutionResult } from "@proto-kit/sequencer";
import { Balance, TokenId, UInt64 } from "@proto-kit/library";
import { Provable, PublicKey } from "o1js";

export const handleCreatePool = async (
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
};
