import "reflect-metadata";
import { runtimeMethod, RuntimeModule, runtimeModule } from "@proto-kit/module";
import { inject } from "tsyringe";
import { Balances } from "./balances";
import { OrderBook } from "./orderbook";
import { PoolModule } from "./pool";
import { Route } from "../utils/route";

interface RouterModuleConfig {}

@runtimeModule()
export class RouterModule extends RuntimeModule<RouterModuleConfig> {
    public constructor(
        @inject("Balances") private balances: Balances,
        @inject("OrderBook") private orderBook: OrderBook,
        @inject("PoolModule") private poolModule: PoolModule
    ) {
        super();
    }

    @runtimeMethod()
    public async tradeRoute(route: Route) {}
}
