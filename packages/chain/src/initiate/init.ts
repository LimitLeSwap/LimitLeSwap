import { Field, PrivateKey, PublicKey, UInt64 } from "o1js";
import { Balance, UInt64 as PUInt64, TokenId } from "@proto-kit/library";
import { client as appChain } from "../environments/client.config";
import { InMemorySigner } from "@proto-kit/sdk";
import { Balances } from "../runtime/modules/balances";
import { Route } from "../runtime/utils/route";

let tokens = [];

// you are seeing this because I was too lazy to use .env. steal this key if you want :p
const publisherKey = PrivateKey.fromBase58("EKEot89cv2Uq217QaeePEJwoXyVdck7haEwFqJxoSKXmvUntfpTw");
const publisher = publisherKey.toPublicKey();

const signer = PrivateKey.random();
const sender = signer.toPublicKey();

const wallet = PublicKey.fromBase58("B62qnBa7PPM4VrE3LqXx7HjDWPDTs1ePdV7hwwuSkmT31Lrr1CQpJna");

let nonce = 0;

await appChain.start();
const inMemorySigner = new InMemorySigner();

appChain.registerValue({
    Signer: inMemorySigner,
});

const resolvedInMemorySigner = appChain.resolve("Signer") as InMemorySigner;
resolvedInMemorySigner.config = { signer };

const balances = appChain.runtime.resolve("Balances");
const orderbook = appChain.runtime.resolve("OrderBook");
const pool = appChain.runtime.resolve("PoolModule");
const router = appChain.runtime.resolve("RouterModule");

const initEnv = async () => {
    console.log(publisher.toBase58());

    for (let i = 0; i < 4; i++) {
        try {
            const tokenId = TokenId.random();
            tokens.push(tokenId);
            console.log("Creating token: ", tokenId.toBigInt());
            const tx = await appChain.transaction(publisher, async () => {
                await balances.createToken(tokenId);
            });

            tx.transaction!.nonce = UInt64.from(nonce++);
            tx.transaction = tx.transaction?.sign(publisherKey);
            await tx.send();

            let mintTx = await appChain.transaction(publisher, async () => {
                await balances.mintToken(tokenId, wallet, PUInt64.from(1000000000));
            });

            mintTx.transaction!.nonce = UInt64.from(nonce++);
            mintTx.transaction = mintTx.transaction?.sign(publisherKey);
            await mintTx.send();

            mintTx = await appChain.transaction(publisher, async () => {
                await balances.mintToken(tokenId, publisher, PUInt64.from(1000000000));
            });

            mintTx.transaction!.nonce = UInt64.from(nonce++);
            mintTx.transaction = mintTx.transaction?.sign(publisherKey);
            await mintTx.send();
        } catch (e) {
            console.log(e);
        }
    }

    const tokenIn = await balances.tokens.get(Field.from(0));
    const tokenOut = await balances.tokens.get(Field.from(1));
    const amountIn = Balance.from(100);
    const amountOut = Balance.from(100);
    const expiration = UInt64.from(1);

    let tx = await appChain.transaction(publisher, async () => {
        await balances.mintToken(tokenIn.value, publisher, PUInt64.from(100));
    });

    tx.transaction!.nonce = UInt64.from(nonce++);
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
    tx.transaction!.nonce = UInt64.from(nonce++);
    tx.transaction = tx.transaction?.sign(publisherKey);
    await tx.send();

    tx = await appChain.transaction(publisher, async () => {
        await orderbook.cancelLimitOrder(Field.from(0));
    });
    console.log("Canceling limit order");
    tx.transaction!.nonce = UInt64.from(nonce++);
    tx.transaction = tx.transaction?.sign(publisherKey);
    await tx.send();

    tx = await appChain.transaction(publisher, async () => {
        await pool.createPool(
            tokens[0],
            tokens[1],
            PUInt64.from(300000000),
            PUInt64.from(500000000),
            publisher,
            PUInt64.from(2),
            Balance.from(BigInt(Math.floor(Math.sqrt(300 * 500) * Number(1000000) - 1000)))
        );
    });
    console.log("Creating pool");
    tx.transaction!.nonce = UInt64.from(nonce++);
    tx.transaction = tx.transaction?.sign(publisherKey);
    await tx.send();

    tx = await appChain.transaction(publisher, async () => {
        await pool.createPool(
            tokens[1],
            tokens[2],
            PUInt64.from(200000000),
            PUInt64.from(300000000),
            publisher,
            PUInt64.from(2),
            Balance.from(BigInt(Math.floor(Math.sqrt(200 * 300) * Number(1000000) - 1000)))
        );
    });
    console.log("Creating pool 2");
    tx.transaction!.nonce = UInt64.from(nonce++);
    tx.transaction = tx.transaction?.sign(publisherKey);
    await tx.send();
};

const testTransactions = async () => {
    console.log("Testing trade route");
    const emptyRoute = Route.empty();

    const tx = await appChain.transaction(publisher, async () => {
        await router.tradeRoute(emptyRoute);
    });

    tx.transaction!.nonce = UInt64.from(nonce++);
    tx.transaction = tx.transaction?.sign(publisherKey);
    await tx.send();
};

await initEnv();
await testTransactions();
process.exit(0);
