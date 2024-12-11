import "reflect-metadata";
import { runtimeMethod, RuntimeModule, runtimeModule } from "@proto-kit/module";
import { inject } from "tsyringe";
import { PoolModule } from "./pool";
import { MAX_ROUTE_SIZE, Route } from "../utils/route";

interface RouterModuleConfig {}

@runtimeModule()
export class RouterModule extends RuntimeModule<RouterModuleConfig> {
    public constructor(@inject("PoolModule") private poolModule: PoolModule) {
        super();
    }

    @runtimeMethod()
    public async tradeRoute(route: Route) {
        for (let i = 0; i < MAX_ROUTE_SIZE - 1; i++) {
            const step = route.path[i];
            await this.poolModule.swapWithLimit(
                step.tokenIn,
                step.tokenOut,
                step.amountIn,
                step.amountOut,
                step.limitOrders
            );
        }
    }
}
