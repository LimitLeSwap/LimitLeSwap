import { BlockHandler, HandlersRecord } from "@proto-kit/processor";
import { PrismaClient } from "@prisma/client-processor";
import { appChain } from "./../utils/app-chain";
import {
    handleBalancesBurnToken,
    handleBalancesCreateToken,
    handleBalancesMintToken,
    handleBalancesSafeTransfer,
} from "./transactions/balances";
import { handleCancelLimitOrder, handleCreateLimitOrder } from "./transactions/orderbook";
import {
    handlePoolAddLiquidity,
    handlePoolCreatePool,
    handlePoolRemoveLiquidity,
} from "./transactions/pool";

const handleTransactions: BlockHandler<PrismaClient> = async (
    client,
    { block, result: blockResult }
) => {
    for (const tx of block.transactions) {
        const methodId = tx.tx.methodId.toBigInt();

        const methodDescriptor = appChain.runtime.methodIdResolver.getMethodNameFromId(methodId);

        if (methodDescriptor === undefined) {
            throw new Error("Unable to retrieve the method descriptor");
        }

        const moduleName = methodDescriptor[0];
        const methodName = methodDescriptor[1];

        // eslint-disable-next-line sonarjs/no-small-switch, default-case
        switch (moduleName) {
            case "Balances":
                // eslint-disable-next-line max-len
                // eslint-disable-next-line sonarjs/no-small-switch, default-case, sonarjs/no-nested-switch
                switch (methodName) {
                    case "mintToken":
                        await handleBalancesMintToken(client, block, tx);
                        break;

                    case "burnToken":
                        await handleBalancesBurnToken(client, block, tx);
                        break;

                    case "safeTransfer":
                        await handleBalancesSafeTransfer(client, block, tx);
                        break;

                    case "createToken":
                        await handleBalancesCreateToken(client, block, tx);
                        break;
                }
                break;

            case "OrderBook":
                // eslint-disable-next-line max-len
                // eslint-disable-next-line sonarjs/no-small-switch, default-case, sonarjs/no-nested-switch
                switch (methodName) {
                    case "createLimitOrder":
                        await handleCreateLimitOrder(client, block, tx);
                        break;

                    case "cancelLimitOrder":
                        await handleCancelLimitOrder(client, block, tx);
                        break;
                }
                break;

            case "PoolModule":
                // eslint-disable-next-line max-len
                // eslint-disable-next-line sonarjs/no-small-switch, default-case, sonarjs/no-nested-switch
                switch (methodName) {
                    case "createPool":
                        await handlePoolCreatePool(client, block, tx);
                        break;

                    case "addLiquidity":
                        await handlePoolAddLiquidity(client, block, tx);
                        break;

                    case "removeLiquidity":
                        await handlePoolRemoveLiquidity(client, block, tx);
                        break;

                    case "swap":
                        // await handlePoolSwap(client, block, tx);
                        break;

                    case "swapWithLimit":
                        // await handlePoolSwapWithLimit(client, block, tx);
                        break;
                }
                break;
        }
    }
};

export const handlers: HandlersRecord<PrismaClient> = {
    onBlock: [handleTransactions],
};
