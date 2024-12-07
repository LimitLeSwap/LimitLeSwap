import "reflect-metadata";
import { TestingAppChain } from "@proto-kit/sdk";
import { Field, PrivateKey } from "o1js";
import { Balances } from "../../../src/runtime/modules/balances";
import { log } from "@proto-kit/common";
import { BalancesKey, TokenId, UInt64 } from "@proto-kit/library";
import { OrderBook } from "../../../src/runtime/modules/orderbook";
import { UInt64 as o1UInt64 } from "o1js";

log.setLevel("ERROR");

describe("balances", () => {
    let appChain: ReturnType<
        typeof TestingAppChain.fromRuntime<{
            Balances: typeof Balances;
            OrderBook: typeof OrderBook;
        }>
    >;

    let balances: Balances;
    let orderbook: OrderBook;

    const signerPrivateKey = PrivateKey.random();
    const signer = signerPrivateKey.toPublicKey();

    const alicePrivateKey = PrivateKey.random();
    const alice = alicePrivateKey.toPublicKey();

    const tokenId1 = TokenId.from(0);
    const tokenId2 = TokenId.from(1);

    beforeAll(async () => {
        appChain = TestingAppChain.fromRuntime({
            Balances,
            OrderBook,
        });

        appChain.configurePartial({
            Runtime: {
                Balances: {},
                OrderBook: {},
            },
        });

        await appChain.start();

        appChain.setSigner(signerPrivateKey);

        balances = appChain.runtime.resolve("Balances");
        orderbook = appChain.runtime.resolve("OrderBook");
        const tx0 = await appChain.transaction(signer, async () => {
            await balances.createToken(tokenId1);
            await balances.createToken(tokenId2);
        });

        await tx0.sign();
        await tx0.send();

        await appChain.produceBlock();
    });

    it("alice mints some token", async () => {
        const tx1 = await appChain.transaction(signer, async () => {
            await balances.mintToken(tokenId1, alice, UInt64.from(1000));
        });

        await tx1.sign();
        await tx1.send();

        const block = await appChain.produceBlock();

        const key = new BalancesKey({ tokenId: tokenId1, address: alice });
        const balance = await appChain.query.runtime.Balances.balances.get(key);

        expect(block?.transactions[0].status.toBoolean()).toBe(true);
        expect(balance?.toBigInt()).toBe(1000n);
    });

    it("alice creates a limit order", async () => {
        appChain.setSigner(alicePrivateKey);
        const tx2 = await appChain.transaction(alice, async () => {
            await orderbook.createLimitOrder(
                tokenId1,
                tokenId2,
                Field.from(100),
                Field.from(100),
                o1UInt64.from(1)
            );
        });

        await tx2.sign();
        await tx2.send();

        const block2 = await appChain.produceBlock();
        const orderNonce = await appChain.query.runtime.OrderBook.orderNonce.get();
        const order = await appChain.query.runtime.OrderBook.orders.get(Field.from(0));

        expect(block2?.transactions[0].status.toBoolean()).toBe(true);
        expect(order?.tokenIn.toString()).toBe("0");
        expect(order?.tokenOut.toString()).toBe("1");
        expect(order?.tokenInAmount.toBigInt()).toBe(100n);
        expect(order?.tokenOutAmount.toBigInt()).toBe(100n);
        expect(order?.owner.toBase58()).toBe(alice.toBase58());
        expect(order?.expiration.toString()).toBe("3");
        expect(order?.isActive.toBoolean()).toBe(true);
    });

    it("order expires", async () => {
        const block3 = await appChain.produceBlock();

        const orderNonce = await appChain.query.runtime.OrderBook.orderNonce.get();
        const order = await appChain.query.runtime.OrderBook.orders.get(orderNonce!);

        expect(order?.isActive.toBoolean()).toBe(false);
    });

    it("alice creates another limit order", async () => {
        const tx4 = await appChain.transaction(alice, async () => {
            await orderbook.createLimitOrder(
                tokenId1,
                tokenId2,
                Field.from(300),
                Field.from(200),
                o1UInt64.from(10)
            );
        });

        await tx4.sign();
        await tx4.send();

        const block4 = await appChain.produceBlock();
        const orderNonce = await appChain.query.runtime.OrderBook.orderNonce.get();
        const order = await appChain.query.runtime.OrderBook.orders.get(orderNonce?.sub(1)!);

        expect(block4?.transactions[0].status.toBoolean()).toBe(true);
        expect(order?.tokenIn.toString()).toBe("0");
        expect(order?.tokenOut.toString()).toBe("1");
        expect(order?.tokenInAmount.toBigInt()).toBe(300n);
        expect(order?.tokenOutAmount.toBigInt()).toBe(200n);
        expect(order?.expiration.toString()).toBe("5");
        expect(order?.isActive.toBoolean()).toBe(true);
    });

    it("order is canceled", async () => {
        const tx5 = await appChain.transaction(alice, async () => {
            const orderNonce = await appChain.query.runtime.OrderBook.orderNonce.get();
            await orderbook.cancelLimitOrder(orderNonce!);
        });

        await tx5.sign();
        await tx5.send();

        const block5 = await appChain.produceBlock();
        const orderNonce = await appChain.query.runtime.OrderBook.orderNonce.get();
        const order = await appChain.query.runtime.OrderBook.orders.get(orderNonce?.sub(1)!);

        expect(block5?.transactions[0].status.toBoolean()).toBe(true);
        expect(order?.isActive.toBoolean()).toBe(false);
    });

    it("should demonstrate how safeTransfer works", async () => {
        const tx3 = await appChain.transaction(alice, async () => {
            await balances.safeTransfer(tokenId1, alice, signer, UInt64.from(500));
        });

        await tx3.sign();
        await tx3.send();

        const block3 = await appChain.produceBlock();

        const key = new BalancesKey({ tokenId: tokenId1, address: alice });
        const balance = await appChain.query.runtime.Balances.balances.get(key);

        expect(block3?.transactions[0].status.toBoolean()).toBe(true);
        expect(balance?.toBigInt()).toBe(0n);
    });
});
