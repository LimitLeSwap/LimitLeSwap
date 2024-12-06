import { Field, PrivateKey, UInt64 } from "o1js";
import { UInt64 as PUInt64, TokenId } from "@proto-kit/library";
import { client as appChain } from "../environments/client.config";
import { InMemorySigner } from "@proto-kit/sdk";

const startClient = async () => {
    const publisherKey = PrivateKey.random();
    const publisher = publisherKey.toPublicKey();

    const signer = PrivateKey.random();
    const sender = signer.toPublicKey();
    await appChain.start();
    const inMemorySigner = new InMemorySigner();

    appChain.registerValue({
        Signer: inMemorySigner,
    });

    const resolvedInMemorySigner = appChain.resolve("Signer") as InMemorySigner;
    resolvedInMemorySigner.config = { signer };

    console.log(publisher.toBase58());

    const balances = appChain.runtime.resolve("Balances");
    for (let i = 0; i < 4; i++) {
        const tokenId = TokenId.random();
        console.log("Creating token: ", tokenId.toBigInt());
        const tx = await appChain.transaction(publisher, async () => {
            await balances.createToken(tokenId);
        });

        tx.transaction!.nonce = UInt64.from(i);
        tx.transaction = tx.transaction?.sign(publisherKey);
        await tx.send();
    }

    const limitOrder = appChain.runtime.resolve("LimitOrders");
    const tokenIn = await balances.tokens.get(Field.from(0));
    const tokenOut = await balances.tokens.get(Field.from(1));
    const amountIn = Field.from(100);
    const amountOut = Field.from(100);
    const expiration = UInt64.from(1);

    let tx = await appChain.transaction(publisher, async () => {
        await balances.mintToken(tokenIn.value, publisher, PUInt64.from(100));
    });

    tx.transaction!.nonce = UInt64.from(4);
    tx.transaction = tx.transaction?.sign(publisherKey);
    await tx.send();
    tx = await appChain.transaction(publisher, async () => {
        await limitOrder.createLimitOrder(
            tokenIn.value,
            tokenOut.value,
            amountIn,
            amountOut,
            expiration
        );
    });
    console.log("Creating limit order");
    tx.transaction!.nonce = UInt64.from(5);
    tx.transaction = tx.transaction?.sign(publisherKey);
    await tx.send();

    tx = await appChain.transaction(publisher, async () => {
        await limitOrder.cancelLimitOrder(Field.from(0));
    });
    console.log("Canceling limit order");
    tx.transaction!.nonce = UInt64.from(6);
    tx.transaction = tx.transaction?.sign(publisherKey);
    await tx.send();
};

await startClient();
