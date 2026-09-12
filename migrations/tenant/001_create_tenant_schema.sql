-- QuickStore Tenant Schema Template
-- This is run programmatically for each new tenant
-- Replace {SCHEMA_NAME} with tenant_abc123 format

CREATE SCHEMA IF NOT EXISTS {SCHEMA_NAME};

CREATE TABLE IF NOT EXISTS {SCHEMA_NAME}.categories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,
  slug          VARCHAR(100) UNIQUE NOT NULL,
  parent_id     UUID REFERENCES {SCHEMA_NAME}.categories(id) ON DELETE CASCADE,
  image_url     TEXT,
  sort_order    INTEGER DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS {SCHEMA_NAME}.products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  price         DECIMAL(10,2) NOT NULL,
  mrp           DECIMAL(10,2),
  stock         INTEGER NOT NULL DEFAULT 0,
  unit          VARCHAR(30),
  category_id   UUID REFERENCES {SCHEMA_NAME}.categories(id) ON DELETE SET NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  images        TEXT[],
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS {SCHEMA_NAME}.customers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100),
  phone         VARCHAR(15) UNIQUE NOT NULL,
  email         VARCHAR(150),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS {SCHEMA_NAME}.addresses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id   UUID NOT NULL REFERENCES {SCHEMA_NAME}.customers(id) ON DELETE CASCADE,
  label         VARCHAR(50),
  line1         TEXT NOT NULL,
  line2         TEXT,
  city          VARCHAR(100),
  pincode       VARCHAR(10),
  lat           DECIMAL(10,8),
  lng           DECIMAL(11,8),
  is_default    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS {SCHEMA_NAME}.orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number    VARCHAR(20) UNIQUE NOT NULL,
  customer_id     UUID NOT NULL REFERENCES {SCHEMA_NAME}.customers(id) ON DELETE RESTRICT,
  address_id      UUID NOT NULL REFERENCES {SCHEMA_NAME}.addresses(id) ON DELETE RESTRICT,
  status          VARCHAR(30) NOT NULL DEFAULT 'PLACED',
  subtotal        DECIMAL(10,2) NOT NULL,
  discount_amt    DECIMAL(10,2) NOT NULL DEFAULT 0,
  delivery_fee    DECIMAL(10,2) NOT NULL DEFAULT 0,
  total           DECIMAL(10,2) NOT NULL,
  payment_mode    VARCHAR(20),
  payment_status  VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  notes           TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS {SCHEMA_NAME}.order_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL REFERENCES {SCHEMA_NAME}.orders(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES {SCHEMA_NAME}.products(id) ON DELETE RESTRICT,
  product_name  VARCHAR(200) NOT NULL,
  price         DECIMAL(10,2) NOT NULL,
  quantity      INTEGER NOT NULL,
  subtotal      DECIMAL(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS {SCHEMA_NAME}.payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id            UUID UNIQUE NOT NULL REFERENCES {SCHEMA_NAME}.orders(id) ON DELETE CASCADE,
  razorpay_order_id   VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  amount              DECIMAL(10,2) NOT NULL,
  currency            VARCHAR(5) NOT NULL DEFAULT 'INR',
  status              VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  webhook_payload     JSONB,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS {SCHEMA_NAME}.discounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            VARCHAR(30) UNIQUE NOT NULL,
  type            VARCHAR(20) NOT NULL,
  value           DECIMAL(10,2) NOT NULL,
  min_order_amt   DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_discount    DECIMAL(10,2),
  usage_limit     INTEGER,
  used_count      INTEGER NOT NULL DEFAULT 0,
  valid_from      TIMESTAMP,
  valid_until     TIMESTAMP,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS {SCHEMA_NAME}.delivery_agents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,
  phone         VARCHAR(15) UNIQUE NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS {SCHEMA_NAME}.deliveries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID UNIQUE NOT NULL REFERENCES {SCHEMA_NAME}.orders(id) ON DELETE CASCADE,
  agent_id        UUID REFERENCES {SCHEMA_NAME}.delivery_agents(id) ON DELETE SET NULL,
  status          VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  estimated_time  INTEGER,
  notes           TEXT,
  assigned_at     TIMESTAMP,
  delivered_at    TIMESTAMP
);

CREATE TABLE IF NOT EXISTS {SCHEMA_NAME}.storefront_config (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  theme               VARCHAR(30) NOT NULL DEFAULT 'QUICKCART',
  logo_url            TEXT,
  banner_url          TEXT,
  primary_color       VARCHAR(7) NOT NULL DEFAULT '#16a34a',
  store_name          VARCHAR(100),
  tagline             VARCHAR(200),
  business_hours      JSONB,
  contact_phone       VARCHAR(15),
  contact_email       VARCHAR(150),
  delivery_radius_km  INTEGER DEFAULT 5,
  min_order_amt       DECIMAL(10,2) DEFAULT 0,
  delivery_fee        DECIMAL(10,2) DEFAULT 0,
  free_delivery_above DECIMAL(10,2),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON {SCHEMA_NAME}.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON {SCHEMA_NAME}.products(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON {SCHEMA_NAME}.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON {SCHEMA_NAME}.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON {SCHEMA_NAME}.order_items(order_id);

-- Default config row
INSERT INTO {SCHEMA_NAME}.storefront_config (theme, store_name)
VALUES ('QUICKCART', 'My Store');

COMMENT ON SCHEMA {SCHEMA_NAME} IS 'Vendor-specific business data';
