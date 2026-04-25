-- 0001_initial.sql
-- All five MVP tables defined now so future plan slices don't need to
-- coordinate cross-cutting migrations. Only `products` is wired to Go in
-- the persistence-foundation plan; others are reserved for future plans
-- (auth, audit, subscriptions).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

CREATE TABLE tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    persona     TEXT NOT NULL CHECK (persona IN ('issuer','distributor','investor','ops','admin')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    role        TEXT NOT NULL CHECK (role IN ('admin','member','viewer','approver')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, email)
);
CREATE INDEX idx_users_tenant ON users (tenant_id);

CREATE TABLE products (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    code              TEXT NOT NULL,
    name              TEXT NOT NULL,
    product_type      TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','approved','active','matured','cancelled')),
    rails_product_id  TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, code)
);

CREATE TABLE subscriptions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id        UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    investor_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount_minor      BIGINT NOT NULL CHECK (amount_minor >= 0),
    currency          TEXT NOT NULL CHECK (length(currency) = 3),
    status            TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','approved','allocated','settled','cancelled')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_subscriptions_product ON subscriptions (product_id);

CREATE TABLE audit_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    actor_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    action          TEXT NOT NULL,
    resource_type   TEXT NOT NULL CHECK (resource_type IN ('product','subscription','user','tenant')),
    resource_id     UUID NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_events_tenant_resource
    ON audit_events (tenant_id, resource_type, resource_id);
