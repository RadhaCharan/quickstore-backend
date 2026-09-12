# QuickStore — Complete POC Technical Blueprint

> **Version:** 1.0 | **Date:** 2026-09-06 | **Status:** Active POC

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Monorepo Folder Structure](#4-monorepo-folder-structure)
5. [Microservice Modules](#5-microservice-modules)
6. [Database Schema Design](#6-database-schema-design)
7. [API Contracts](#7-api-contracts)
8. [Feature Flag Configuration Model](#8-feature-flag-configuration-model)
9. [UI Theme Strategy](#9-ui-theme-strategy)
10. [PWA Strategy](#10-pwa-strategy)
11. [Phased Delivery Roadmap](#11-phased-delivery-roadmap)
12. [Infra Cost Analysis](#12-infra-cost-analysis)
13. [Pricing Strategy](#13-pricing-strategy)
14. [Post-POC Roadmap](#14-post-poc-roadmap)

---

## 1. Executive Summary

**QuickStore** is a multi-tenant SaaS platform that enables local vendors (kirana stores, boutiques, food vendors, hardware shops) to launch their own branded e-commerce storefront in minutes — with no technical knowledge required.

### Core Value Proposition
- Vendor signs up → selects features → team reviews → storefront goes live
- Each vendor gets a PWA (works on Android + iOS without app store)
- Customers shop via vendor's branded store URL: `{vendor}.quickstore.in`
- Platform handles payments (Razorpay), delivery tracking, orders, discounts

### Competitors & Differentiation
| Competitor | Target | Gap |
|---|---|---|
| Blinkit / Zepto | Consumers | No vendor self-serve tools |
| Instaamart / Swiggy | Consumers | No white-label for local vendors |
| Dukaan | Small biz | No delivery tracking, no hyperlocal |
| **QuickStore** | Local vendors | Full white-label + delivery + hyperlocal |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌─────────────────┐         ┌──────────────────────────────┐   │
│  │  Vendor Admin   │         │   Customer Storefront PWA    │   │
│  │  Portal (React) │         │   {vendor}.quickstore.in     │   │
│  │  /vendor/*      │         │   (Config-driven, 4 themes)  │   │
│  └────────┬────────┘         └──────────────┬───────────────┘   │
│           │                                 │                   │
│  ┌────────┴─────────────────────────────────┴───────────────┐   │
│  │            Super Admin Panel (React)                      │   │
│  │            /admin/* (feature review, vendor management)   │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTPS / REST
┌──────────────────────▼──────────────────────────────────────────┐
│                   API GATEWAY (NestJS)                           │
│              Rate Limiting | Auth Middleware                     │
│              Tenant Resolution | Request Routing                 │
└──┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬────────────┘
   │      │      │      │      │      │      │      │
   ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼
┌────┐ ┌────┐ ┌─────┐ ┌─────┐ ┌────┐ ┌────┐ ┌────┐ ┌──────┐
│Auth│ │Tnt │ │Prod │ │Order│ │Del │ │Pay │ │Disc│ │Store │
│Svc │ │Svc │ │ Svc │ │ Svc │ │Svc │ │Svc │ │Svc │ │front │
└──┬─┘ └─┬──┘ └──┬──┘ └──┬──┘ └─┬──┘ └─┬──┘ └─┬──┘ └──┬───┘
   │      │       │        │      │      │      │        │
   └──────┴───────┴────────┴──────┴──────┴──────┴────────┘
                            │
              ┌─────────────▼─────────────┐
              │     DATA LAYER            │
              │  ┌──────────┐ ┌────────┐  │
              │  │PostgreSQL│ │ Redis  │  │
              │  │(Platform │ │(Cache/ │  │
              │  │+ Tenant  │ │Session)│  │
              │  │ Schemas) │ └────────┘  │
              │  └──────────┘             │
              │  ┌──────────┐             │
              │  │   S3     │             │
              │  │(Images/  │             │
              │  │ Assets)  │             │
              │  └──────────┘             │
              └───────────────────────────┘
```

### 2.2 Multi-Tenant Request Flow

```
Customer visits: freshveggies.quickstore.in
         │
         ▼
API Gateway extracts subdomain → resolves tenant_id
         │
         ▼
Tenant Middleware: validates tenant, loads feature flags
         │
         ▼
Routes to correct vendor schema in PostgreSQL
         │
         ▼
Returns config-driven storefront (theme + products + branding)
```

### 2.3 Vendor Onboarding Flow

```
Vendor signs up (name, store, contact, category)
         │
         ▼
Selects features from checklist (products, orders, delivery, discounts...)
         │
         ▼
Request goes to Admin queue (manual review by QuickStore team)
         │
         ▼
Admin activates features → generates tenant schema → sends login link
         │
         ▼
Vendor logs in → customizes theme (logo, color, banner)
         │
         ▼
Store is LIVE at {vendor-slug}.quickstore.in
```

---

## 3. Technology Stack

| Layer | Technology | Reason |
|---|---|---|
| Backend Framework | NestJS (Node.js) | Modular, microservice-ready, TypeScript |
| Frontend | React 18 + Vite | Fast builds, PWA support |
| State Management | Zustand | Lightweight vs Redux |
| Styling | TailwindCSS | Rapid UI, theme tokens |
| Database | PostgreSQL 15 | Schema-per-tenant support |
| Cache / Session | Redis 7 | Fast session lookup, rate limiting |
| ORM | TypeORM | NestJS native, migration support |
| Auth | JWT + Refresh Tokens | Stateless, multi-tenant safe |
| File Storage | AWS S3 | Images, vendor assets |
| CDN | AWS CloudFront | Serve PWA + assets globally |
| Payments | Razorpay | India-first, UPI + cards |
| Email | AWS SES | Order confirmations, OTPs |
| PWA | vite-plugin-pwa | Service worker, offline cache |
| Containerization | Docker + docker-compose | Local dev + AWS ECS deploy |
| API Documentation | Swagger (OpenAPI) | Auto-generated from NestJS decorators |
| Validation | class-validator + zod | Input sanitization |
| Monorepo | npm workspaces | Shared types across apps |

---

## 4. Monorepo Folder Structure

```
quickstore/
│
├── apps/
│   ├── api/                          # NestJS Backend
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── common/
│   │   │   │   ├── decorators/
│   │   │   │   │   └── tenant.decorator.ts
│   │   │   │   ├── guards/
│   │   │   │   │   ├── jwt.guard.ts
│   │   │   │   │   └── tenant.guard.ts
│   │   │   │   ├── middleware/
│   │   │   │   │   └── tenant.middleware.ts
│   │   │   │   ├── interceptors/
│   │   │   │   │   └── response.interceptor.ts
│   │   │   │   └── pipes/
│   │   │   │       └── validation.pipe.ts
│   │   │   ├── config/
│   │   │   │   ├── database.config.ts
│   │   │   │   ├── redis.config.ts
│   │   │   │   └── jwt.config.ts
│   │   │   └── modules/
│   │   │       ├── auth/
│   │   │       │   ├── auth.module.ts
│   │   │       │   ├── auth.controller.ts
│   │   │       │   ├── auth.service.ts
│   │   │       │   └── dto/
│   │   │       ├── tenant/
│   │   │       │   ├── tenant.module.ts
│   │   │       │   ├── tenant.controller.ts
│   │   │       │   ├── tenant.service.ts
│   │   │       │   ├── tenant.entity.ts
│   │   │       │   └── dto/
│   │   │       ├── product/
│   │   │       │   ├── product.module.ts
│   │   │       │   ├── product.controller.ts
│   │   │       │   ├── product.service.ts
│   │   │       │   ├── product.entity.ts
│   │   │       │   └── dto/
│   │   │       ├── category/
│   │   │       │   ├── category.module.ts
│   │   │       │   ├── category.controller.ts
│   │   │       │   ├── category.service.ts
│   │   │       │   └── category.entity.ts
│   │   │       ├── order/
│   │   │       │   ├── order.module.ts
│   │   │       │   ├── order.controller.ts
│   │   │       │   ├── order.service.ts
│   │   │       │   ├── order.entity.ts
│   │   │       │   └── dto/
│   │   │       ├── delivery/
│   │   │       │   ├── delivery.module.ts
│   │   │       │   ├── delivery.controller.ts
│   │   │       │   ├── delivery.service.ts
│   │   │       │   └── delivery.entity.ts
│   │   │       ├── payment/
│   │   │       │   ├── payment.module.ts
│   │   │       │   ├── payment.controller.ts
│   │   │       │   ├── payment.service.ts
│   │   │       │   └── dto/
│   │   │       ├── discount/
│   │   │       │   ├── discount.module.ts
│   │   │       │   ├── discount.controller.ts
│   │   │       │   ├── discount.service.ts
│   │   │       │   └── discount.entity.ts
│   │   │       ├── customer/
│   │   │       │   ├── customer.module.ts
│   │   │       │   ├── customer.controller.ts
│   │   │       │   ├── customer.service.ts
│   │   │       │   └── customer.entity.ts
│   │   │       └── storefront/
│   │   │           ├── storefront.module.ts
│   │   │           ├── storefront.controller.ts
│   │   │           ├── storefront.service.ts
│   │   │           └── dto/
│   │   ├── migrations/
│   │   │   ├── platform/
│   │   │   │   └── 001_create_platform_tables.sql
│   │   │   └── tenant/
│   │   │       └── 001_create_tenant_schema.sql
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   └── web/                          # React PWA (Vendor Admin + Customer Store)
│       ├── public/
│       │   ├── manifest.json         # PWA manifest
│       │   └── icons/
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── router/
│       │   │   └── index.tsx
│       │   ├── pages/
│       │   │   ├── vendor/           # Vendor admin portal
│       │   │   │   ├── Dashboard.tsx
│       │   │   │   ├── Products.tsx
│       │   │   │   ├── Orders.tsx
│       │   │   │   ├── Delivery.tsx
│       │   │   │   ├── Discounts.tsx
│       │   │   │   ├── Customers.tsx
│       │   │   │   └── Settings.tsx
│       │   │   ├── store/            # Customer storefront
│       │   │   │   ├── Home.tsx
│       │   │   │   ├── Category.tsx
│       │   │   │   ├── Product.tsx
│       │   │   │   ├── Cart.tsx
│       │   │   │   ├── Checkout.tsx
│       │   │   │   └── OrderStatus.tsx
│       │   │   ├── auth/
│       │   │   │   ├── VendorLogin.tsx
│       │   │   │   └── CustomerLogin.tsx
│       │   │   └── onboarding/
│       │   │       ├── VendorSignup.tsx
│       │   │       └── FeatureSelector.tsx
│       │   ├── components/
│       │   │   ├── themes/
│       │   │   │   ├── QuickCart/    # Blinkit/Zepto style
│       │   │   │   ├── FreshMart/    # Instamart/Swiggy style
│       │   │   │   ├── StyleHub/     # Fashion/Boutique
│       │   │   │   └── LocalPro/     # Electronics/Hardware
│       │   │   ├── common/
│       │   │   │   ├── Header.tsx
│       │   │   │   ├── ProductCard.tsx
│       │   │   │   ├── CartDrawer.tsx
│       │   │   │   ├── SearchBar.tsx
│       │   │   │   └── CategoryGrid.tsx
│       │   │   └── vendor/
│       │   │       ├── ProductForm.tsx
│       │   │       ├── OrderTable.tsx
│       │   │       └── StoreCustomizer.tsx
│       │   ├── store/                # Zustand state
│       │   │   ├── cartStore.ts
│       │   │   ├── authStore.ts
│       │   │   └── storefrontStore.ts
│       │   ├── services/             # API calls
│       │   │   ├── api.ts
│       │   │   ├── productService.ts
│       │   │   ├── orderService.ts
│       │   │   └── paymentService.ts
│       │   └── hooks/
│       │       ├── useCart.ts
│       │       ├── useTenant.ts
│       │       └── useProducts.ts
│       ├── package.json
│       ├── vite.config.ts
│       └── tailwind.config.js
│
├── packages/
│   └── shared/                       # Shared types + constants
│       ├── src/
│       │   ├── types/
│       │   │   ├── tenant.types.ts
│       │   │   ├── product.types.ts
│       │   │   ├── order.types.ts
│       │   │   └── feature-flags.types.ts
│       │   └── constants/
│       │       ├── features.ts
│       │       └── themes.ts
│       └── package.json
│
├── docker-compose.yml
├── .env.example
├── package.json                      # Monorepo root
└── QUICKSTORE-BLUEPRINT.md
```

---

## 5. Microservice Modules

Each module is a NestJS module — self-contained, replaceable with a true microservice later.

### 5.1 Auth Module
- **Responsibility:** Vendor login, customer login, JWT issue/refresh, OTP
- **Entities:** `platform.users`, `platform.refresh_tokens`
- **Key flows:** Vendor sign-in → JWT with `{tenant_id, role}` claim

### 5.2 Tenant Module
- **Responsibility:** Vendor registration, feature activation, tenant config
- **Entities:** `platform.tenants`, `platform.feature_flags`, `platform.subscriptions`
- **Key flows:** Vendor signup → admin review → feature flags ON → schema created

### 5.3 Product Module
- **Responsibility:** CRUD products, image upload to S3, stock management
- **Entities:** `{tenant_schema}.products`, `{tenant_schema}.product_images`
- **Tenant-scoped:** Yes (all queries filtered by tenant schema)

### 5.4 Category Module
- **Responsibility:** Product categorization, category tree (max 2 levels for POC)
- **Entities:** `{tenant_schema}.categories`
- **Tenant-scoped:** Yes

### 5.5 Order Module
- **Responsibility:** Cart → order placement → status tracking → order history
- **Entities:** `{tenant_schema}.orders`, `{tenant_schema}.order_items`
- **Tenant-scoped:** Yes

### 5.6 Delivery Module
- **Responsibility:** Assign delivery agent, update delivery status (manual)
- **Entities:** `{tenant_schema}.deliveries`, `{tenant_schema}.delivery_agents`
- **Status flow:** `PENDING → ASSIGNED → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED`

### 5.7 Payment Module
- **Responsibility:** Razorpay order creation, webhook handling, payment verification
- **External:** Razorpay API
- **Entities:** `{tenant_schema}.payments`

### 5.8 Discount Module
- **Responsibility:** Coupon codes, percentage/flat discounts, validity windows
- **Entities:** `{tenant_schema}.discounts`
- **Feature-flagged:** Only available if vendor has `DISCOUNT` feature enabled

### 5.9 Customer Module
- **Responsibility:** Customer registration, profile, saved addresses
- **Entities:** `{tenant_schema}.customers`, `{tenant_schema}.addresses`
- **Tenant-scoped:** Yes (customer of vendor A ≠ customer of vendor B)

### 5.10 Storefront Module
- **Responsibility:** Return full storefront config (theme, branding, features, products)
- **No DB entity** — aggregates from other services
- **Key endpoint:** `GET /storefront/:slug` → returns everything the PWA needs to render

---

## 6. Database Schema Design

### 6.1 Platform Database (shared — `platform` schema)

```sql
-- Vendor accounts
CREATE TABLE platform.tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          VARCHAR(50) UNIQUE NOT NULL,   -- 'freshveggies' -> freshveggies.quickstore.in
  name          VARCHAR(100) NOT NULL,
  owner_name    VARCHAR(100),
  email         VARCHAR(150) UNIQUE NOT NULL,
  phone         VARCHAR(15),
  category      VARCHAR(50),                   -- grocery, fashion, food, electronics
  status        VARCHAR(20) DEFAULT 'PENDING', -- PENDING, ACTIVE, SUSPENDED
  plan          VARCHAR(20) DEFAULT 'STARTER', -- STARTER, GROWTH, PRO
  schema_name   VARCHAR(60) UNIQUE,            -- tenant_abc123
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- Feature flags per vendor
CREATE TABLE platform.feature_flags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES platform.tenants(id),
  feature       VARCHAR(50) NOT NULL,          -- PRODUCTS, ORDERS, DELIVERY, DISCOUNTS, SEARCH, ANALYTICS
  enabled       BOOLEAN DEFAULT FALSE,
  enabled_at    TIMESTAMP,
  UNIQUE(tenant_id, feature)
);

-- Subscription plans
CREATE TABLE platform.subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES platform.tenants(id),
  plan          VARCHAR(20) NOT NULL,
  price_inr     INTEGER NOT NULL,
  billing_cycle VARCHAR(10) DEFAULT 'MONTHLY',
  starts_at     DATE NOT NULL,
  expires_at    DATE,
  status        VARCHAR(20) DEFAULT 'ACTIVE'
);

-- Platform users (vendor owners + super admins)
CREATE TABLE platform.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES platform.tenants(id),
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  role          VARCHAR(20) NOT NULL,           -- SUPER_ADMIN, VENDOR_OWNER, VENDOR_STAFF
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Onboarding requests (manual review queue)
CREATE TABLE platform.onboarding_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES platform.tenants(id),
  requested_features TEXT[],                   -- ['PRODUCTS','ORDERS','DELIVERY']
  store_description  TEXT,
  reviewed_by   UUID REFERENCES platform.users(id),
  reviewed_at   TIMESTAMP,
  status        VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);
```

### 6.2 Vendor Schema (per-tenant — `tenant_{schema_name}`)

```sql
-- Products
CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  price         DECIMAL(10,2) NOT NULL,
  mrp           DECIMAL(10,2),
  stock         INTEGER DEFAULT 0,
  unit          VARCHAR(30),                    -- kg, litre, piece, pack
  category_id   UUID REFERENCES categories(id),
  is_active     BOOLEAN DEFAULT TRUE,
  images        TEXT[],                         -- S3 URLs
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- Categories (max 2 levels)
CREATE TABLE categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  slug          VARCHAR(100) UNIQUE NOT NULL,
  parent_id     UUID REFERENCES categories(id),
  image_url     TEXT,
  sort_order    INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE
);

-- Customers (scoped per vendor)
CREATE TABLE customers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100),
  phone         VARCHAR(15) UNIQUE NOT NULL,
  email         VARCHAR(150),
  otp_hash      VARCHAR(255),
  otp_expires   TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Billing / Delivery Addresses
CREATE TABLE addresses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID REFERENCES customers(id),
  label         VARCHAR(50),                    -- Home, Work, Other
  line1         TEXT NOT NULL,
  line2         TEXT,
  city          VARCHAR(100),
  pincode       VARCHAR(10),
  lat           DECIMAL(10,8),
  lng           DECIMAL(11,8),
  is_default    BOOLEAN DEFAULT FALSE
);

-- Orders
CREATE TABLE orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number  VARCHAR(20) UNIQUE NOT NULL,
  customer_id   UUID REFERENCES customers(id),
  address_id    UUID REFERENCES addresses(id),
  status        VARCHAR(30) DEFAULT 'PLACED',  -- PLACED, CONFIRMED, PREPARING, OUT_FOR_DELIVERY, DELIVERED, CANCELLED
  subtotal      DECIMAL(10,2) NOT NULL,
  discount_amt  DECIMAL(10,2) DEFAULT 0,
  delivery_fee  DECIMAL(10,2) DEFAULT 0,
  total         DECIMAL(10,2) NOT NULL,
  payment_mode  VARCHAR(20),                    -- RAZORPAY, COD
  payment_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PAID, FAILED, REFUNDED
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- Order Line Items
CREATE TABLE order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID REFERENCES orders(id),
  product_id    UUID REFERENCES products(id),
  product_name  VARCHAR(200) NOT NULL,          -- snapshot at order time
  price         DECIMAL(10,2) NOT NULL,
  quantity      INTEGER NOT NULL,
  subtotal      DECIMAL(10,2) NOT NULL
);

-- Payments
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID REFERENCES orders(id),
  razorpay_order_id  VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  amount          DECIMAL(10,2) NOT NULL,
  currency        VARCHAR(5) DEFAULT 'INR',
  status          VARCHAR(20) DEFAULT 'PENDING',
  webhook_payload JSONB,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Discounts / Coupons
CREATE TABLE discounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(30) UNIQUE NOT NULL,
  type          VARCHAR(20) NOT NULL,           -- PERCENTAGE, FLAT
  value         DECIMAL(10,2) NOT NULL,
  min_order_amt DECIMAL(10,2) DEFAULT 0,
  max_discount  DECIMAL(10,2),
  usage_limit   INTEGER,
  used_count    INTEGER DEFAULT 0,
  valid_from    TIMESTAMP,
  valid_until   TIMESTAMP,
  is_active     BOOLEAN DEFAULT TRUE
);

-- Deliveries
CREATE TABLE deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID UNIQUE REFERENCES orders(id),
  agent_id        UUID REFERENCES delivery_agents(id),
  status          VARCHAR(30) DEFAULT 'PENDING', -- PENDING, ASSIGNED, PICKED_UP, OUT_FOR_DELIVERY, DELIVERED, FAILED
  estimated_time  INTEGER,                        -- minutes
  notes           TEXT,
  assigned_at     TIMESTAMP,
  delivered_at    TIMESTAMP
);

-- Delivery Agents
CREATE TABLE delivery_agents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  phone         VARCHAR(15) UNIQUE NOT NULL,
  is_active     BOOLEAN DEFAULT TRUE
);

-- Storefront Config (branding per vendor)
CREATE TABLE storefront_config (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme         VARCHAR(30) DEFAULT 'QUICKCART', -- QUICKCART, FRESHMART, STYLEHUB, LOCALPRO
  logo_url      TEXT,
  banner_url    TEXT,
  primary_color VARCHAR(7) DEFAULT '#16a34a',
  store_name    VARCHAR(100),
  tagline       VARCHAR(200),
  business_hours JSONB,                          -- { mon: {open: '09:00', close: '21:00'}, ... }
  contact_phone  VARCHAR(15),
  contact_email  VARCHAR(150),
  delivery_radius_km INTEGER DEFAULT 5,
  min_order_amt  DECIMAL(10,2) DEFAULT 0,
  delivery_fee   DECIMAL(10,2) DEFAULT 0,
  free_delivery_above DECIMAL(10,2),
  updated_at     TIMESTAMP DEFAULT NOW()
);
```

---

## 7. API Contracts

Base URL: `https://api.quickstore.in/v1`
Tenant header: `X-Tenant-Slug: {vendor-slug}` OR resolved from subdomain

### 7.1 Auth APIs

```
POST   /auth/vendor/login          - Vendor login (email + password) → JWT
POST   /auth/vendor/refresh        - Refresh access token
POST   /auth/customer/send-otp     - Send OTP to customer phone
POST   /auth/customer/verify-otp   - Verify OTP → customer JWT
POST   /auth/logout                - Invalidate refresh token
```

### 7.2 Tenant / Onboarding APIs

```
POST   /tenant/signup              - Vendor registration + feature request
GET    /tenant/me                  - Get current vendor's config
PATCH  /tenant/me                  - Update vendor profile
GET    /tenant/features            - Get enabled features for this tenant

# Super Admin only
GET    /admin/onboarding-requests  - List pending vendor review requests
PATCH  /admin/onboarding-requests/:id/approve - Approve + activate features
PATCH  /admin/onboarding-requests/:id/reject  - Reject with notes
GET    /admin/tenants              - List all vendors
PATCH  /admin/tenants/:id/suspend  - Suspend vendor
```

### 7.3 Storefront API (Public — no auth)

```
GET    /storefront/:slug           - Full storefront config (theme, branding, features, featured products)
GET    /storefront/:slug/products  - Paginated product listing with search + filter
GET    /storefront/:slug/products/:id - Single product detail
GET    /storefront/:slug/categories   - Category tree
```

### 7.4 Product APIs (Vendor Auth)

```
GET    /products                   - List vendor products (paginated, filterable)
POST   /products                   - Create product
GET    /products/:id               - Get product detail
PATCH  /products/:id               - Update product
DELETE /products/:id               - Soft delete product
POST   /products/:id/images        - Upload product images to S3
PATCH  /products/:id/stock         - Update stock quantity
```

### 7.5 Category APIs (Vendor Auth)

```
GET    /categories                 - List categories
POST   /categories                 - Create category
PATCH  /categories/:id             - Update category
DELETE /categories/:id             - Delete (only if no products linked)
```

### 7.6 Order APIs

```
# Customer
POST   /orders                     - Place order (cart → order)
GET    /orders/:id                 - Get order status (public with order token)
POST   /orders/:id/cancel          - Cancel order (before CONFIRMED)

# Vendor Auth
GET    /orders                     - List all orders (filterable by status, date)
PATCH  /orders/:id/status          - Update order status
GET    /orders/analytics           - Basic stats (today's orders, revenue)
```

### 7.7 Delivery APIs

```
# Vendor Auth
GET    /delivery/agents            - List delivery agents
POST   /delivery/agents            - Add delivery agent
PATCH  /delivery/agents/:id        - Update agent

GET    /delivery                   - List deliveries
PATCH  /delivery/:id/assign        - Assign agent to delivery
PATCH  /delivery/:id/status        - Update delivery status
```

### 7.8 Payment APIs

```
POST   /payments/create-order      - Create Razorpay order → returns order_id + key
POST   /payments/verify            - Verify payment signature after Razorpay success
POST   /payments/webhook           - Razorpay webhook (payment.captured, refund.created)
GET    /payments/:order_id         - Payment status for an order
```

### 7.9 Discount APIs

```
# Customer
POST   /discounts/apply            - Apply coupon code to cart → returns discount amount

# Vendor Auth
GET    /discounts                  - List all coupons
POST   /discounts                  - Create coupon
PATCH  /discounts/:id              - Update coupon
DELETE /discounts/:id              - Deactivate coupon
```

### 7.10 Customer APIs (Vendor Auth + Customer Auth)

```
GET    /customers                  - Vendor: list all customers
GET    /customers/:id              - Vendor: customer detail + order history

GET    /customers/me               - Customer: own profile
PATCH  /customers/me               - Customer: update profile
GET    /customers/me/addresses     - List saved addresses
POST   /customers/me/addresses     - Add address
PATCH  /customers/me/addresses/:id - Update address
DELETE /customers/me/addresses/:id - Remove address
```

### 7.11 Storefront Config (Vendor Auth)

```
GET    /storefront/config          - Get current branding config
PATCH  /storefront/config          - Update theme, logo, colors, hours
POST   /storefront/config/logo     - Upload logo to S3
POST   /storefront/config/banner   - Upload banner to S3
```

---

## 8. Feature Flag Configuration Model

Feature flags control what each vendor can access. Stored in `platform.feature_flags`.

### Available Features

| Feature Key | Description | Plans Available |
|---|---|---|
| `PRODUCTS` | Product listing and management | All plans |
| `CATEGORIES` | Product categorization | All plans |
| `ORDERS` | Order management | All plans |
| `SEARCH` | Search bar on storefront | All plans |
| `CUSTOMER_ACCOUNTS` | Customer login, profiles | Growth + Pro |
| `SAVED_ADDRESSES` | Multiple billing/delivery addresses | Growth + Pro |
| `DISCOUNTS` | Coupon codes, percentage/flat discounts | Growth + Pro |
| `DELIVERY_TRACKING` | Delivery agent assignment + status | Growth + Pro |
| `ANALYTICS` | Basic order/revenue dashboard | Pro only |
| `CUSTOM_DOMAIN` | vendor.com instead of vendor.quickstore.in | Pro only |
| `MULTI_THEME` | Access to all 4 themes | Growth + Pro |

### Feature Resolution Flow

```typescript
// Middleware resolves on every request
const features = await featureFlagService.getEnabled(tenantId);
// Returns: ['PRODUCTS', 'ORDERS', 'SEARCH', 'DELIVERY_TRACKING']

// Guard on controller
@RequireFeature('DISCOUNTS')
@Post('/discounts')
createDiscount() { ... }
// Returns 403 if DISCOUNTS not in feature list
```

### Plan → Feature Mapping

```typescript
export const PLAN_FEATURES = {
  STARTER: ['PRODUCTS', 'CATEGORIES', 'ORDERS', 'SEARCH'],
  GROWTH:  ['PRODUCTS', 'CATEGORIES', 'ORDERS', 'SEARCH',
             'CUSTOMER_ACCOUNTS', 'SAVED_ADDRESSES',
             'DISCOUNTS', 'DELIVERY_TRACKING', 'MULTI_THEME'],
  PRO:     ['PRODUCTS', 'CATEGORIES', 'ORDERS', 'SEARCH',
             'CUSTOMER_ACCOUNTS', 'SAVED_ADDRESSES',
             'DISCOUNTS', 'DELIVERY_TRACKING', 'MULTI_THEME',
             'ANALYTICS', 'CUSTOM_DOMAIN'],
};
```

---

## 9. UI Theme Strategy

### 4 Pre-built Themes

| Theme | Color Palette | Inspired By | Best For |
|---|---|---|---|
| **QuickCart** | Dark bg + Green CTAs | Blinkit / Zepto | Grocery, Kirana, FMCG |
| **FreshMart** | Warm orange + white | Instamart / Swiggy | Food, Dairy, Fresh produce |
| **StyleHub** | Minimal white + purple | Myntra style | Fashion, Boutique, Accessories |
| **LocalPro** | Professional blue + grey | B2B / Hardware | Electronics, Tools, Hardware |

### Per-Vendor Customization (within theme)

```typescript
interface StorefrontConfig {
  theme: 'QUICKCART' | 'FRESHMART' | 'STYLEHUB' | 'LOCALPRO';
  storeName: string;
  tagline: string;
  logoUrl: string;
  bannerUrl: string;
  primaryColor: string;       // hex — from curated 8-color palette per theme
  businessHours: BusinessHours;
  contactPhone: string;
  deliveryRadiusKm: number;
  minOrderAmount: number;
  deliveryFee: number;
  freeDeliveryAbove: number;
}
```

### What is NOT customizable in POC

- Layout structure
- Font families
- Component positioning
- Custom CSS injection

These are Phase 2 features.

---

## 10. PWA Strategy

### Why PWA over Native Apps

- No app store approval needed
- Single codebase works on Android + iOS
- Installable from browser (Add to Home Screen)
- Works with slow/no internet (service worker cache)
- Zero distribution cost vs ₹7,500+ Apple developer fee

### PWA Configuration

```json
{
  "name": "{Vendor Store Name}",
  "short_name": "{Vendor Slug}",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "{primaryColor}",
  "icons": [
    { "src": "{logo_url}", "sizes": "192x192", "type": "image/png" },
    { "src": "{logo_url}", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Service Worker Cache Strategy

```
- Static assets (CSS, JS, fonts)  → Cache First
- Product images                   → Stale While Revalidate
- API calls (products, config)     → Network First with fallback
- Order placement                  → Network Only (never offline)
```

### Subdomain per vendor

- `freshveggies.quickstore.in` → PWA with FreshVeggies branding
- Wildcard SSL cert (`*.quickstore.in`) covers all vendors
- CloudFront + S3 serves the same React build, vendor config loaded on mount

---

## 11. Phased Delivery Roadmap

### Phase 1 — Foundation (Weeks 1–3)

**Goal:** Monorepo running, auth working, tenant creation, DB migrations

| Task | Owner | Days |
|---|---|---|
| Monorepo setup (npm workspaces, Docker) | Backend | 1 |
| PostgreSQL + Redis setup (docker-compose) | Backend | 1 |
| Platform schema migrations | Backend | 1 |
| Auth module (JWT, vendor login, OTP) | Backend | 3 |
| Tenant module (signup, feature flags) | Backend | 3 |
| Schema creation on tenant approval | Backend | 2 |
| React app scaffold (Vite + Tailwind + PWA) | Frontend | 2 |
| Router setup (vendor/* + store/* routes) | Frontend | 1 |
| Vendor login page + auth store (Zustand) | Frontend | 2 |

**Deliverable:** Vendor can sign up, admin approves, vendor can log in

---

### Phase 2 — Core Commerce (Weeks 4–7)

**Goal:** Products, categories, orders working end-to-end

| Task | Owner | Days |
|---|---|---|
| Category module + CRUD APIs | Backend | 2 |
| Product module + S3 image upload | Backend | 4 |
| Order module (cart → order → status) | Backend | 4 |
| Customer module (OTP login, profile) | Backend | 2 |
| Address module | Backend | 2 |
| Vendor product management UI | Frontend | 4 |
| Customer storefront (home, category, PDP) | Frontend | 4 |
| Cart + checkout flow (COD first) | Frontend | 3 |
| Order status page | Frontend | 2 |

**Deliverable:** Vendor can add products; customer can browse, add to cart, place COD order

---

### Phase 3 — Storefront + Themes + Payments (Weeks 8–11)

**Goal:** Branded storefront live, Razorpay integrated, 4 themes working

| Task | Owner | Days |
|---|---|---|
| Storefront config API | Backend | 2 |
| Razorpay integration (create order + webhook) | Backend | 3 |
| Discount module (coupons) | Backend | 2 |
| Feature flag guard on all routes | Backend | 2 |
| 4 theme components (QuickCart, FreshMart, StyleHub, LocalPro) | Frontend | 6 |
| Store customizer UI (logo, color, banner) | Frontend | 3 |
| Razorpay checkout integration on PWA | Frontend | 2 |
| Coupon code UI at checkout | Frontend | 1 |
| PWA manifest + service worker | Frontend | 2 |

**Deliverable:** Vendor storefront live at subdomain, Razorpay payments working, PWA installable

---

### Phase 4 — Delivery + Polish + Launch (Weeks 12–16)

**Goal:** Delivery tracking, vendor analytics, production deploy on AWS

| Task | Owner | Days |
|---|---|---|
| Delivery module (agents, assignment, status) | Backend | 4 |
| Vendor order management + delivery assign UI | Frontend | 4 |
| Customer order tracking page | Frontend | 2 |
| Basic vendor analytics dashboard | Frontend | 3 |
| Super admin panel (tenant management) | Frontend | 4 |
| AWS ECS + RDS + CloudFront setup | DevOps | 3 |
| Wildcard SSL + Route53 subdomain config | DevOps | 1 |
| End-to-end testing (5 vendor scenarios) | QA | 5 |
| Performance testing + PWA Lighthouse audit | QA | 2 |
| Documentation + vendor onboarding guide | All | 2 |

**Deliverable:** Production-ready POC, 5+ pilot vendors onboarded

---

## 12. Infra Cost Analysis

### Shared AWS Infrastructure (Multi-Tenant Pool)

| Component | Spec | Monthly Cost |
|---|---|---|
| ECS Fargate (2 tasks) | 1 vCPU, 2GB RAM each | $45 |
| RDS PostgreSQL | db.t3.medium, 100GB SSD | $55 |
| ElastiCache Redis | cache.t3.micro | $15 |
| Application Load Balancer | - | $18 |
| CloudFront CDN | ~200GB/month transfer | $20 |
| S3 Storage | ~400GB (product images) | $10 |
| AWS SES | ~50,000 emails/month | $5 |
| Route53 | Wildcard hosted zone | $2 |
| **Total Shared Pool** | | **~$170/month** |

### Cost Per Vendor at Scale

| Active Vendors | Infra Cost/Vendor/Month |
|---|---|
| 10 | ~$17 |
| 25 | ~$7 |
| 50 | ~$3.5 |
| 100 | ~$1.7 |

**GCP Alternative:** Cloud Run (serverless) saves ~20% on compute for low-traffic vendors.

---

## 13. Pricing Strategy

### Monthly Plans

| Plan | Price (INR) | Price (USD) | Features |
|---|---|---|---|
| **Starter** | ₹799/month | ~$9.50 | Products, Categories, Orders, Search |
| **Growth** | ₹1,499/month | ~$18 | + Delivery, Discounts, Customer accounts, Addresses, Analytics |
| **Pro** | ₹2,499/month | ~$30 | + Custom domain, All themes, Priority support |

### Transaction Revenue

- Platform takes **0.5% fee** on every order processed via Razorpay
- Example: Vendor with 150 orders/month × ₹500 avg → ₹375 platform revenue per vendor
- Scales automatically with vendor GMV

### Gross Margin at 50 Vendors (Mixed Plans)

```
Revenue:
  30 × Starter (₹799)    = ₹23,970
  15 × Growth  (₹1,499)  = ₹22,485
   5 × Pro     (₹2,499)  = ₹12,495
  Transaction fees (est)  = ₹15,000
  Total Monthly Revenue   = ₹73,950 (~$885)

Cost:
  AWS Infra               = $170 (~₹14,200)
  Support team (part-time)= ₹15,000
  Total Monthly Cost      = ~₹29,200

Gross Margin: ~60%
```

---

## 14. Post-POC Roadmap (Phase 5+)

| Feature | Phase | Priority |
|---|---|---|
| AI-driven feature analysis (GPT/Claude) | Phase 5 | High |
| Native Android + iOS apps | Phase 5 | High |
| GPS delivery tracking (real-time) | Phase 5 | High |
| Vendor analytics (cohort, LTV, heatmap) | Phase 5 | Medium |
| Multi-language (Hindi, regional) | Phase 6 | Medium |
| WhatsApp order notifications | Phase 5 | High |
| Vendor marketplace (QuickStore discovery page) | Phase 6 | Low |
| Drag-and-drop storefront editor | Phase 7 | Low |
| B2B ordering (bulk vendor orders) | Phase 7 | Low |
| Loyalty points system | Phase 6 | Medium |

---

## Team Recommendation for POC

| Role | Count | Responsibility |
|---|---|---|
| Backend Engineer | 2 | NestJS modules, DB, APIs, Razorpay |
| Frontend Engineer | 2 | React PWA, themes, vendor admin |
| DevOps Engineer | 1 (part-time) | Docker, AWS setup, CI/CD |
| Product/QA | 1 | Testing, vendor onboarding, pilot |
| **Total** | **~5 people** | **16-week POC** |

---

*Document maintained by QuickStore Engineering Team*
*Last updated: 2026-09-06*
