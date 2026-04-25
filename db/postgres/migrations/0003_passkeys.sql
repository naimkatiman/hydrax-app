-- 0003_passkeys.sql
-- WebAuthn (passkey) credentials. Multi-credential per user — code paths
-- and indexes assume a user can register N passkeys (e.g., laptop + phone).
-- Slice 2a: server-side substrate only. Slice 2d adds UI for managing
-- these credentials.

CREATE TABLE user_passkeys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id   BYTEA NOT NULL,
    public_key      BYTEA NOT NULL,
    counter         BIGINT NOT NULL DEFAULT 0,
    transports      TEXT[] NOT NULL DEFAULT '{}',
    aaguid          UUID,
    nickname        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_user_passkeys_credential_id ON user_passkeys (credential_id);
CREATE INDEX idx_user_passkeys_user ON user_passkeys (user_id);
