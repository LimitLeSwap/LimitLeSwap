import { BlockHandler, HandlersRecord } from "@proto-kit/processor";
import { PrismaClient } from "@prisma/client-processor";
import { appChain } from "./../utils/app-chain";
import {
    handleBalancesBurnToken,
    handleBalancesCreateToken,
    handleBalancesMintToken,
    handleBalancesSafeTransfer,
} from "./transactions/balances";

const handleTransactions: BlockHandler<PrismaClient> = async (
    client,
    { block, result: blockResult }
) => {
    // iterate over all transactions
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

            // case "PoolModule":
            //     // eslint-disable-next-line max-len
            //     // eslint-disable-next-line sonarjs/no-small-switch, default-case, sonarjs/no-nested-switch
            //     switch (methodName) {
            //         case "createPool":
            //             // await handlePoolCreatePool(client, block, tx);
            //             break;
            //     }
            //     break;
        }
    }
};

export const handlers: HandlersRecord<PrismaClient> = {
    onBlock: [handleTransactions],
};
