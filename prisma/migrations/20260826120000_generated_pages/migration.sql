CREATE TABLE "generated_pages" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "html" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "generated_pages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "generated_pages_slug_key" ON "generated_pages"("slug");
CREATE INDEX "generated_pages_tenantId_createdAt_idx" ON "generated_pages"("tenantId","createdAt");
