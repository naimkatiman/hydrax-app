-- 0004_magic_links.sql
-- Magic-link enrollment tokens. Single-use, short TTL (default 15 min).
-- Stored as sha256(token) — never the raw token. Slice 2b ships the
-- console-stdout transport for dev/staging; slice 2c adds real email.

CREATE TABLE magic_link_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    token_hash  BYTEA NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_magic_link_tokens_token_hash ON magic_link_tokens (token_hash);
CREATE INDEX idx_magic_link_tokens_user ON magic_link_tokens (user_id);
CREATE INDEX idx_magic_link_tokens_active ON magic_link_tokens (expires_at) WHERE used_at IS NULL;
