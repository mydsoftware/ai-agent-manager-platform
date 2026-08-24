CREATE TABLE "agents" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "systemPrompt" TEXT,
  "tools" JSONB NOT NULL DEFAULT '[]',
  "permissions" JSONB NOT NULL DEFAULT '[]',
  "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
  "approvalPolicy" TEXT NOT NULL DEFAULT 'AUTO',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "agent_runs" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "input" JSONB,
  "output" JSONB,
  "error" TEXT,
  "tokensUsed" INTEGER NOT NULL DEFAULT 0,
  "creditsUsed" INTEGER NOT NULL DEFAULT 0,
  "iterations" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "agent_memories" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_memories_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'USER';
CREATE UNIQUE INDEX "agents_tenantId_slug_key" ON "agents"("tenantId","slug");
CREATE INDEX "agents_tenantId_idx" ON "agents"("tenantId");
CREATE INDEX "agent_runs_tenantId_agentId_createdAt_idx" ON "agent_runs"("tenantId","agentId","createdAt");
CREATE INDEX "agent_memories_tenantId_agentId_createdAt_idx" ON "agent_memories"("tenantId","agentId","createdAt");
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId","createdAt");
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId","createdAt");
ALTER TABLE "agents" ADD CONSTRAINT "agents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
