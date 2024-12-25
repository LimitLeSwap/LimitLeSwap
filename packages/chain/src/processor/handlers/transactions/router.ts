import { BlockHandler } from "@proto-kit/processor";
import { PrismaClient } from "@prisma/client-processor";
import { appChain } from "../../utils/app-chain";
import { MethodParameterEncoder } from "@proto-kit/module";
import { Block, TransactionExecutionResult } from "@proto-kit/sequencer";
import { Route } from "../../../runtime/utils/route";
import { calculatePoolId, handleSwapWithLimitOrderPrisma } from "./utils";

export const handleRouterTradeRoute = async (
    client: Parameters<BlockHandler<PrismaClient>>[0],
    block: Block,
    tx: TransactionExecutionResult
) => {
    const module = appChain.runtime.resolve("RouterModule");

    const parameterDecoder = MethodParameterEncoder.fromMethod(module, "tradeRoute");

    // @ts-expect-error
    const [route]: [Route] = await parameterDecoder.decode(tx.tx.argsFields, tx.tx.auxiliaryData);

    for (const step of route.path) {
        console.table({
            tokenIn: step.tokenIn.toBigInt(),
            tokenOut: step.tokenOut.toBigInt(),
            amountIn: step.amountIn.toBigInt(),
            amountOut: step.amountOut.toBigInt(),
            limitOrders: step.limitOrders.bundle.map((order) => order.toBigInt()),
        });

        const poolId = calculatePoolId(step.tokenIn, step.tokenOut);

        await handleSwapWithLimitOrderPrisma(
            client,
            tx.tx.hash().toString(),
            poolId.toString(),
            tx.tx.sender.toBase58(),
            step.tokenIn,
            step.tokenOut,
            step.amountIn,
            step.amountOut,
            step.limitOrders.bundle,
            Number(block.height.toString())
        );
    }

    console.log("Route trade executed");
};
