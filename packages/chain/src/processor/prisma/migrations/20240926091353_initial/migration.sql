-- CreateTable Block
CREATE TABLE "Block" (
    "height" INTEGER NOT NULL,
    "timestamp" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "Block_pkey" PRIMARY KEY ("height")
);

-- CreateTable Token
CREATE TABLE "Token" (
    "tokenId" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "totalSupply" BIGINT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
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
);

CREATE INDEX "Balance_tokenId_idx" ON "Balance" ("tokenId");
CREATE INDEX "Balance_address_idx" ON "Balance" ("address");

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
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "Pool_pkey" PRIMARY KEY ("poolId")
);

-- CreateTable Swap
CREATE TABLE "Swap" (
    "id" SERIAL,
    "txHash" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "token0Amount" BIGINT NOT NULL,
    "token1Amount" BIGINT NOT NULL,
    "token0In1Out" BOOLEAN NOT NULL,
    "token0Price" NUMERIC(38, 18) NOT NULL,
    "token1Price" NUMERIC(38, 18) NOT NULL,
    "blockHeight" INTEGER NOT NULL,
    "owner" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "Swap_pkey" PRIMARY KEY ("id")
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
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "LimitOrder_pkey" PRIMARY KEY ("orderId")
);

CREATE INDEX "LimitOrder_active_idx" ON "LimitOrder" ("active");
CREATE INDEX "LimitOrder_owner_idx" ON "LimitOrder" ("owner");
CREATE INDEX "LimitOrder_poolId_idx" ON "LimitOrder" ("poolId");
CREATE INDEX "LimitOrder_token0Price_token1Price_idx" ON "LimitOrder" ("token0Price", "token1Price");
CREATE INDEX "LimitOrder_active_poolId_idx" ON "LimitOrder" ("active", "poolId");
CREATE INDEX "LimitOrder_owner_active_idx" ON "LimitOrder" ("owner", "active");

-- Create block-based candle table
CREATE TABLE "BlockCandle" (
  "id" TEXT NOT NULL,
  "blockHeight" INT NOT NULL,
  "poolId" TEXT NOT NULL,

  "token0Id" TEXT NOT NULL,
  "token1Id" TEXT NOT NULL,

  "openT0" NUMERIC(38, 18) NOT NULL,
  "highT0" NUMERIC(38, 18) NOT NULL,
  "lowT0" NUMERIC(38, 18) NOT NULL,
  "closeT0" NUMERIC(38, 18) NOT NULL,
  "volumeT0" BIGINT NOT NULL,

  "openT1" NUMERIC(38, 18) NOT NULL,
  "highT1" NUMERIC(38, 18) NOT NULL,
  "lowT1" NUMERIC(38, 18) NOT NULL,
  "closeT1" NUMERIC(38, 18) NOT NULL,
  "volumeT1" BIGINT NOT NULL,

  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "BlockCandle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BlockCandle_blockHeight_idx" ON "BlockCandle" ("blockHeight");
CREATE INDEX "BlockCandle_poolId_idx" ON "BlockCandle" ("poolId");
CREATE INDEX "BlockCandle_token0Id_token1Id_idx" ON "BlockCandle" ("token0Id", "token1Id"); 