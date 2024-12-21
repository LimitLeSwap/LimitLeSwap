-- CreateTable Block
CREATE TABLE "Block" (
    "height" INTEGER NOT NULL,
    CONSTRAINT "Block_pkey" PRIMARY KEY ("height")
);

-- CreateTable Token
CREATE TABLE "Token" (
    "tokenId" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "totalSupply" BIGINT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "Token_pkey" PRIMARY KEY ("tokenId")
);

INSERT INTO "Token" ("tokenId", "decimals", "totalSupply", "createdAt")
VALUES ('0', 6, 0, NOW()) -- Todo: change decimals
ON CONFLICT ("tokenId") DO NOTHING;

-- CreateTable Balance
CREATE TABLE "Balance" (
    "height" INTEGER NOT NULL,
    "tokenId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    CONSTRAINT "Balance_pkey" PRIMARY KEY ("height","address","tokenId")
    -- CONSTRAINT "Balance_block_fkey" FOREIGN KEY ("height") REFERENCES "Block" ("height") ON DELETE CASCADE ON UPDATE CASCADE,
    -- CONSTRAINT "Balance_token_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token" ("tokenId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CREATE INDEX "Balance_address_idx" ON "Balance" ("address");
-- CREATE INDEX "Balance_tokenId_idx" ON "Balance" ("tokenId");

-- CreateTable Pool
CREATE TABLE "Pool" (
    "poolId" TEXT NOT NULL,
    "token0Id" TEXT NOT NULL,
    "token1Id" TEXT NOT NULL,
    "token0Amount" BIGINT NOT NULL,
    "token1Amount" BIGINT NOT NULL,
    "totalLpAmount" BIGINT NOT NULL,
    "feePercentage" INTEGER NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "Pool_pkey" PRIMARY KEY ("poolId")
);

-- CreateTable Swap
CREATE TABLE "Swap" (
    "swapId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "token0Amount" BIGINT NOT NULL,
    "token1Amount" BIGINT NOT NULL,
    "token0In1Out" BOOLEAN NOT NULL,
    "token0Price" NUMERIC(38, 18) NOT NULL,
    "token1Price" NUMERIC(38, 18) NOT NULL,
    "blockHeight" INTEGER NOT NULL,
    "owner" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "Swap_pkey" PRIMARY KEY ("swapId")
    -- CONSTRAINT "Swap_pool_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool" ("poolId") ON DELETE CASCADE ON UPDATE CASCADE,
    -- CONSTRAINT "Swap_block_fkey" FOREIGN KEY ("blockHeight") REFERENCES "Block" ("height") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable LimitOrder
CREATE TABLE "LimitOrder" (
    "orderId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "token0Amount" BIGINT NOT NULL,
    "token1Amount" BIGINT NOT NULL,
    "token0Price" NUMERIC(38, 18) NOT NULL,
    "token1Price" NUMERIC(38, 18) NOT NULL,
    "token0In1Out" BOOLEAN NOT NULL,
    "owner" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,
    "expireBlock" INTEGER NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "LimitOrder_pkey" PRIMARY KEY ("orderId")
    -- CONSTRAINT "LimitOrder_pool_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool" ("poolId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "LimitOrder_active_idx" ON "LimitOrder" ("active");
CREATE INDEX "LimitOrder_owner_idx" ON "LimitOrder" ("owner");
CREATE INDEX "LimitOrder_poolId_idx" ON "LimitOrder" ("poolId");
CREATE INDEX "LimitOrder_token0Price_token1Price_idx" ON "LimitOrder" ("token0Price", "token1Price");
CREATE INDEX "LimitOrder_active_poolId_idx" ON "LimitOrder" ("active", "poolId");
CREATE INDEX "LimitOrder_owner_active_idx" ON "LimitOrder" ("owner", "active");

-- CreateTable TokenTrade
CREATE TABLE "TokenTrade" (
    "tradeId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "token0Amount" BIGINT NOT NULL,
    "token1Amount" BIGINT NOT NULL,
    "token0Price" NUMERIC(38, 18) NOT NULL,
    "token1Price" NUMERIC(38, 18) NOT NULL,
    "token0In1Out" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "TokenTrade_pkey" PRIMARY KEY ("tradeId")
    -- CONSTRAINT "TokenTrade_pool_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool" ("poolId") ON DELETE CASCADE ON UPDATE CASCADE
);
