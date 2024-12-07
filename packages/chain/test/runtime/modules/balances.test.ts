import { TestingAppChain } from "@proto-kit/sdk";
import { PrivateKey } from "o1js";
import { Balances } from "../../../src/runtime/modules/balances";
import { log } from "@proto-kit/common";
import { BalancesKey, TokenId, UInt64 } from "@proto-kit/library";

log.setLevel("ERROR");

describe("balances", () => {
    let appChain: ReturnType<typeof TestingAppChain.fromRuntime<{ Balances: typeof Balances }>>;

    let balances: Balances;

    const signerPrivateKey = PrivateKey.random();
    const signer = signerPrivateKey.toPublicKey();

    const alicePrivateKey = PrivateKey.random();
    const alice = alicePrivateKey.toPublicKey();

    const tokenId = TokenId.from(0);

    beforeAll(async () => {
        appChain = TestingAppChain.fromRuntime({
            Balances,
        });

        appChain.configurePartial({
            Runtime: {
                Balances: {},
            },
        });

        await appChain.start();

        appChain.setSigner(signerPrivateKey);

        balances = appChain.runtime.resolve("Balances");
    });

    it("should demonstrate how balances work", async () => {
        const tx1 = await appChain.transaction(signer, async () => {
            await balances.mintToken(tokenId, alice, UInt64.from(1000));
        });

        await tx1.sign();
        await tx1.send();

        const block = await appChain.produceBlock();

        const key = new BalancesKey({ tokenId, address: alice });
        const balance = await appChain.query.runtime.Balances.balances.get(key);

        expect(block?.transactions[0].status.toBoolean()).toBe(true);
        expect(balance?.toBigInt()).toBe(1000n);
    });

    it("should demonstrate how circulatingSupply works", async () => {
        const circulatingSupply =
            await appChain.query.runtime.Balances.circulatingSupply.get(tokenId);

        expect(circulatingSupply!.toBigInt()).toBe(1000n);
    });

    it("burn Token method", async () => {
        const tx2 = await appChain.transaction(signer, async () => {
            await balances.burnToken(tokenId, alice, UInt64.from(500));
        });

        await tx2.sign();
        await tx2.send();

        const block2 = await appChain.produceBlock();

        const key = new BalancesKey({ tokenId, address: alice });
        const balance = await appChain.query.runtime.Balances.balances.get(key);

        expect(block2?.transactions[0].status.toBoolean()).toBe(true);
        expect(balance?.toBigInt()).toBe(500n);
    });

    it("should demonstrate how safeTransfer works", async () => {
        const tx3 = await appChain.transaction(signer, async () => {
            await balances.safeTransfer(tokenId, alice, signer, UInt64.from(500));
        });

        await tx3.sign();
        await tx3.send();

        const block3 = await appChain.produceBlock();

        const key = new BalancesKey({ tokenId, address: alice });
        const balance = await appChain.query.runtime.Balances.balances.get(key);

        expect(block3?.transactions[0].status.toBoolean()).toBe(true);
        expect(balance?.toBigInt()).toBe(0n);
    });
});
