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
