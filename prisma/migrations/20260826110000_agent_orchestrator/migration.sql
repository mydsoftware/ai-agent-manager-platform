DROP TABLE IF EXISTS "purchases";
DROP TABLE IF EXISTS "published_agents";
ALTER TABLE "agents" ADD COLUMN "specialty" TEXT;
ALTER TABLE "agents" ADD COLUMN "keywords" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "agents" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'MANUAL';
CREATE INDEX "agents_tenantId_specialty_idx" ON "agents"("tenantId","specialty");
