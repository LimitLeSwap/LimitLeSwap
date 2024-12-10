import { VanillaRuntimeModules } from "@proto-kit/library";
import { ModulesConfig } from "@proto-kit/common";

import { Balances } from "./modules/balances";
import { OrderBook } from "./modules/orderbook";
import { PoolModule } from "./modules/pool";

export const modules = VanillaRuntimeModules.with({
    Balances,
    OrderBook,
    PoolModule,
});

export const config: ModulesConfig<typeof modules> = {
    Balances: {},
    OrderBook: {},
    PoolModule: {},
};

export default {
    modules,
    config,
};
