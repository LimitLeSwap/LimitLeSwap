import { Balance, VanillaRuntimeModules } from "@proto-kit/library";
import { ModulesConfig } from "@proto-kit/common";

import { Balances } from "./modules/balances";
import { LimitOrders } from "./modules/orderbook";
import { PoolModule } from "./modules/pool";

export const modules = VanillaRuntimeModules.with({
    Balances,
    LimitOrders,
    PoolModule,
});

export const config: ModulesConfig<typeof modules> = {
    Balances: {
        totalSupply: Balance.from(2_000),
    },
    LimitOrders: {},
    PoolModule: {},
};

export default {
    modules,
    config,
};
