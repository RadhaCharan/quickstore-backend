-- QuickStore Platform Schema Migration
-- Run once on database initialization

CREATE SCHEMA IF NOT EXISTS platform;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS platform.tenants (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug          VARCHAR(50) UNIQUE NOT NULL,
  name          VARCHAR(100) NOT NULL,
  owner_name    VARCHAR(100),
  email         VARCHAR(150) UNIQUE NOT NULL,
  phone         VARCHAR(15),
  category      VARCHAR(50),
  status        VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  plan          VARCHAR(20) NOT NULL DEFAULT 'STARTER',
  schema_name   VARCHAR(60) UNIQUE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform.users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID REFERENCES platform.tenants(id) ON DELETE CASCADE,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  role          VARCHAR(30) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform.feature_flags (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  feature       VARCHAR(50) NOT NULL,
  enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  enabled_at    TIMESTAMP,
  UNIQUE(tenant_id, feature)
);

CREATE TABLE IF NOT EXISTS platform.subscriptions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  plan          VARCHAR(20) NOT NULL,
  price_inr     INTEGER NOT NULL,
  billing_cycle VARCHAR(10) NOT NULL DEFAULT 'MONTHLY',
  starts_at     DATE NOT NULL,
  expires_at    DATE,
  status        VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS platform.onboarding_requests (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  requested_features  TEXT[],
  store_description   TEXT,
  reviewed_by         UUID REFERENCES platform.users(id),
  reviewed_at         TIMESTAMP,
  status              VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  notes               TEXT,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON platform.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON platform.tenants(status);
CREATE INDEX IF NOT EXISTS idx_feature_flags_tenant ON platform.feature_flags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_status ON platform.onboarding_requests(status);

-- Seed super admin (change password in production)
INSERT INTO platform.users (email, password_hash, role)
VALUES ('admin@quickstore.in', '$2b$12$placeholder_hash', 'SUPER_ADMIN')
ON CONFLICT (email) DO NOTHING;

COMMENT ON TABLE platform.tenants IS 'One row per vendor (tenant)';
COMMENT ON TABLE platform.feature_flags IS 'Feature flags per tenant — controls which modules are enabled';
COMMENT ON TABLE platform.onboarding_requests IS 'Manual review queue for new vendor signups';
