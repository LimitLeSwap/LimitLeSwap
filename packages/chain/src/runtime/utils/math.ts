import { Balance } from "@proto-kit/library";
import { assert } from "@proto-kit/protocol";
import { Provable } from "o1js";

function sqrtBigInt(value: bigint): bigint {
    if (value < 2n) return value;

    let x0 = value;
    let x1 = (value >> 1n) + 1n;
    while (x1 < x0) {
        x0 = x1;
        x1 = (x1 + value / x1) >> 1n;
    }
    return x0;
}

function minBigInt(a: bigint, b: bigint): bigint {
    return a < b ? a : b;
}

const MINIMUM_LIQUIDITY = 1000n;

export function calculateInitialLPSupply(tokenAmountA: Balance, tokenAmountB: Balance): Balance {
    const initialLPSupply = Provable.witness(Balance, () => {
        return Balance.from(sqrtBigInt(tokenAmountA.toBigInt() * tokenAmountB.toBigInt()));
    });

    assert(
        initialLPSupply.mul(initialLPSupply).lessThanOrEqual(tokenAmountA.mul(tokenAmountB)),
        "Initial LP supply is too large"
    );

    return initialLPSupply.sub(MINIMUM_LIQUIDITY);
}

export function calculateLPShare(
    tokenAmountA: Balance,
    tokenAmountB: Balance,
    reserveA: Balance,
    reserveB: Balance,
    lpSupply: Balance
): Balance {
    const lpShare = Provable.witness(Balance, () => {
        return Balance.from(
            minBigInt(
                (tokenAmountA.toBigInt() * lpSupply.toBigInt()) / reserveA.toBigInt(),
                (tokenAmountB.toBigInt() * lpSupply.toBigInt()) / reserveB.toBigInt()
            )
        );
    });

    assert(lpShare.greaterThan(Balance.from(0)), "Insufficient LP share minted");
    // Todo add more assertions

    return lpShare;
}
