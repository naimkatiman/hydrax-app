-- 0005_approvals.sql
-- Adds the approvals table backing approval-svc's Postgres repo.
-- Until this lands, approval-svc runs an in-memory MemRepo that
-- loses every row on process restart.
--
-- Reverse with: DROP TABLE IF EXISTS approvals CASCADE;
--
-- Plan: docs/plans/2026-04-26-approvals-postgres-persistence.md

CREATE TABLE approvals (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    resource_type      TEXT NOT NULL CHECK (resource_type IN ('product','subscription','user','tenant')),
    resource_id        UUID NOT NULL,
    status             TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','rejected')),
    decided_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    decided_at         TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approvals_tenant_status ON approvals (tenant_id, status);
CREATE INDEX idx_approvals_resource ON approvals (resource_type, resource_id);
