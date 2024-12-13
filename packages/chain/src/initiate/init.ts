import { Field, PrivateKey, PublicKey, UInt64 } from "o1js";
import { Balance, UInt64 as PUInt64, TokenId } from "@proto-kit/library";
import { client as appChain } from "../environments/client.config";
import { InMemorySigner } from "@proto-kit/sdk";
import { Balances } from "../runtime/modules/balances";

const startClient = async () => {
    const publisherKey = PrivateKey.random();
    const publisher = publisherKey.toPublicKey();

    let balances: Balances;

    const signer = PrivateKey.random();
    const sender = signer.toPublicKey();

    const wallet = PublicKey.fromBase58("B62qnBa7PPM4VrE3LqXx7HjDWPDTs1ePdV7hwwuSkmT31Lrr1CQpJna");

    await appChain.start();
    const inMemorySigner = new InMemorySigner();

    appChain.registerValue({
        Signer: inMemorySigner,
    });

    const resolvedInMemorySigner = appChain.resolve("Signer") as InMemorySigner;
    resolvedInMemorySigner.config = { signer };

    console.log(publisher.toBase58());

    balances = appChain.runtime.resolve("Balances");
    for (let i = 0; i < 4; i++) {
        try {
            const tokenId = TokenId.random();
            console.log("Creating token: ", tokenId.toBigInt());
            const tx = await appChain.transaction(publisher, async () => {
                await balances.createToken(tokenId);
            });

            tx.transaction!.nonce = UInt64.from(2 * i);
            tx.transaction = tx.transaction?.sign(publisherKey);
            await tx.send();

            const mintTx = await appChain.transaction(publisher, async () => {
                await balances.mintToken(tokenId, wallet, PUInt64.from(1000000000));
            });

            mintTx.transaction!.nonce = UInt64.from(2 * i + 1);
            mintTx.transaction = mintTx.transaction?.sign(publisherKey);
            await mintTx.send();
        } catch (e) {
            console.log(e);
        }
    }

    const orderbook = appChain.runtime.resolve("OrderBook");
    const tokenIn = await balances.tokens.get(Field.from(0));
    const tokenOut = await balances.tokens.get(Field.from(1));
    const amountIn = Balance.from(100);
    const amountOut = Balance.from(100);
    const expiration = UInt64.from(1);

    let tx = await appChain.transaction(publisher, async () => {
        await balances.mintToken(tokenIn.value, publisher, PUInt64.from(100));
    });

    tx.transaction!.nonce = UInt64.from(4);
    tx.transaction = tx.transaction?.sign(publisherKey);
    await tx.send();
    tx = await appChain.transaction(publisher, async () => {
        await orderbook.createLimitOrder(
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
        await orderbook.cancelLimitOrder(Field.from(0));
    });
    console.log("Canceling limit order");
    tx.transaction!.nonce = UInt64.from(6);
    tx.transaction = tx.transaction?.sign(publisherKey);
    await tx.send();
};

await startClient();
process.exit(0);
