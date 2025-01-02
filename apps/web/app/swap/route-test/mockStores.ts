interface Token {
  name: string;
  icon: string;
  tokenId: string;
}

interface Pool {
  poolId: string;
  token0: Token;
  token1: Token;
  token0Amount: string;
  token1Amount: string;
  fee: string;
  lpTokenSupply: string;
}

interface LimitOrder {
  orderId: number;
  tokenIn: string;
  tokenOut: string;
  tokenInAmount: string;
  tokenOutAmount: string;
  owner: any;
  expiration: string;
  isActive: boolean;
}

export class MockPoolStore {
  private tokenList: Token[] = [];
  private poolList: Pool[] = [];
  private positionList: any[] = [];

  setTokenList(tokens: Token[]) {
    this.tokenList = tokens;
  }

  getTokenList() {
    return this.tokenList;
  }

  setPoolList(pools: Pool[]) {
    this.poolList = pools;
  }

  getPoolList() {
    return this.poolList;
  }

  setPositionList(positions: any[]) {
    this.positionList = positions;
  }

  getPositionList() {
    return this.positionList;
  }
}

export class MockLimitStore {
  private limitOrders: LimitOrder[] = [];

  setLimitOrders(orders: LimitOrder[]) {
    this.limitOrders = orders;
  }

  getLimitOrders() {
    return this.limitOrders;
  }
}
