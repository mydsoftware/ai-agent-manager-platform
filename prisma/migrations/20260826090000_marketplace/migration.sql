CREATE TABLE "published_agents" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "sellerTenantId" TEXT NOT NULL,
  "sellerUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priceCredits" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "salesCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "published_agents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "published_agents_agentId_key" ON "published_agents"("agentId");
CREATE INDEX "published_agents_status_createdAt_idx" ON "published_agents"("status","createdAt");
CREATE TABLE "purchases" (
  "id" TEXT NOT NULL,
  "publishedId" TEXT NOT NULL,
  "buyerTenantId" TEXT NOT NULL,
  "buyerUserId" TEXT NOT NULL,
  "priceCredits" INTEGER NOT NULL,
  "cloneAgentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "purchases_publishedId_buyerTenantId_key" ON "purchases"("publishedId","buyerTenantId");
CREATE INDEX "purchases_buyerTenantId_createdAt_idx" ON "purchases"("buyerTenantId","createdAt");
ALTER TABLE "published_agents" ADD CONSTRAINT "published_agents_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_publishedId_fkey" FOREIGN KEY ("publishedId") REFERENCES "published_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_cloneAgentId_fkey" FOREIGN KEY ("cloneAgentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
