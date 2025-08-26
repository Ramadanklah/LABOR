-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "domain" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "bsnr" TEXT,
    "lanr" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTwoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "lastLogin" TIMESTAMP(3),
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsed" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientBirthDate" TIMESTAMP(3),
    "bsnr" TEXT NOT NULL,
    "lanr" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "resultDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'routine',
    "notes" TEXT,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observations" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "referenceRange" TEXT,
    "interpretation" TEXT,
    "rawValue" TEXT NOT NULL,
    "normalizedValue" TEXT,
    "normalizedUnit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ldt_messages" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rawMessage" TEXT NOT NULL,
    "parsedData" JSONB,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "resultId" TEXT,

    CONSTRAINT "ldt_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ldt_quarantine" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "rawMessage" TEXT NOT NULL,
    "errorDetails" JSONB NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ldt_quarantine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exports" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "filters" JSONB,
    "filePath" TEXT,
    "fileSize" INTEGER,
    "downloadUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resourceId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bsnr_mappings" (
    "id" TEXT NOT NULL,
    "bsnr" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bsnr_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_subdomain_key" ON "tenants"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_tenantId_key" ON "users"("email", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "users_bsnr_lanr_tenantId_key" ON "users"("bsnr", "lanr", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "results_tenantId_createdAt_idx" ON "results"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "results_bsnr_lanr_idx" ON "results"("bsnr", "lanr");

-- CreateIndex
CREATE INDEX "results_patientId_idx" ON "results"("patientId");

-- CreateIndex
CREATE INDEX "observations_tenantId_createdAt_idx" ON "observations"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "observations_code_idx" ON "observations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ldt_messages_messageId_key" ON "ldt_messages"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "ldt_messages_idempotencyKey_key" ON "ldt_messages"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ldt_messages_tenantId_createdAt_idx" ON "ldt_messages"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ldt_messages_status_idx" ON "ldt_messages"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ldt_quarantine_messageId_key" ON "ldt_quarantine"("messageId");

-- CreateIndex
CREATE INDEX "exports_tenantId_createdAt_idx" ON "exports"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "exports_status_idx" ON "exports"("status");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "usage_events_tenantId_createdAt_idx" ON "usage_events"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "usage_events_eventType_idx" ON "usage_events"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "bsnr_mappings_bsnr_key" ON "bsnr_mappings"("bsnr");

-- CreateIndex
CREATE INDEX "bsnr_mappings_bsnr_idx" ON "bsnr_mappings"("bsnr");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ldt_messages" ADD CONSTRAINT "ldt_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ldt_messages" ADD CONSTRAINT "ldt_messages_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bsnr_mappings" ADD CONSTRAINT "bsnr_mappings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable Row Level Security
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "observations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ldt_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ldt_quarantine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usage_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bsnr_mappings" ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
-- Tenants: Only system admins can access
CREATE POLICY "tenants_admin_only" ON "tenants" FOR ALL USING (current_setting('app.current_user_role') = 'admin');

-- Users: Users can only access their own tenant's users
CREATE POLICY "users_tenant_isolation" ON "users" FOR ALL USING (tenant_id = current_setting('app.current_tenant_id'));

-- Results: Users can only access their own tenant's results
CREATE POLICY "results_tenant_isolation" ON "results" FOR ALL USING (tenant_id = current_setting('app.current_tenant_id'));

-- Observations: Users can only access their own tenant's observations
CREATE POLICY "observations_tenant_isolation" ON "observations" FOR ALL USING (tenant_id = current_setting('app.current_tenant_id'));

-- LDT Messages: Users can only access their own tenant's messages
CREATE POLICY "ldt_messages_tenant_isolation" ON "ldt_messages" FOR ALL USING (tenant_id = current_setting('app.current_tenant_id'));

-- Exports: Users can only access their own tenant's exports
CREATE POLICY "exports_tenant_isolation" ON "exports" FOR ALL USING (tenant_id = current_setting('app.current_tenant_id'));

-- Audit Logs: Users can only access their own tenant's logs
CREATE POLICY "audit_logs_tenant_isolation" ON "audit_logs" FOR ALL USING (tenant_id = current_setting('app.current_tenant_id'));

-- Usage Events: Users can only access their own tenant's events
CREATE POLICY "usage_events_tenant_isolation" ON "usage_events" FOR ALL USING (tenant_id = current_setting('app.current_tenant_id'));

-- BSNR Mappings: Users can only access their own tenant's mappings
CREATE POLICY "bsnr_mappings_tenant_isolation" ON "bsnr_mappings" FOR ALL USING (tenant_id = current_setting('app.current_tenant_id'));

-- API Keys: Users can only access their own tenant's keys
CREATE POLICY "api_keys_tenant_isolation" ON "api_keys" FOR ALL USING (tenant_id = current_setting('app.current_tenant_id'));

-- Refresh Tokens: Users can only access their own tokens
CREATE POLICY "refresh_tokens_user_isolation" ON "refresh_tokens" FOR ALL USING (user_id = current_setting('app.current_user_id'));

-- LDT Quarantine: System-wide access for admins
CREATE POLICY "ldt_quarantine_admin_only" ON "ldt_quarantine" FOR ALL USING (current_setting('app.current_user_role') = 'admin');