import {
  Injectable, NotFoundException, ConflictException, BadRequestException, Inject, forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tenant } from './tenant.entity';
import { FeatureFlag } from './entities/feature-flag.entity';
import { OnboardingRequest } from './entities/onboarding-request.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,

    @InjectRepository(FeatureFlag)
    private readonly featureFlagRepo: Repository<FeatureFlag>,

    @InjectRepository(OnboardingRequest)
    private readonly onboardingRepo: Repository<OnboardingRequest>,

    private readonly dataSource: DataSource,

    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  // ─── Signup ───────────────────────────────────────────────────────────────────

  async signup(dto: CreateTenantDto) {
    const existing = await this.tenantRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const slug = this.buildSlug(dto.name);
    const slugExists = await this.tenantRepo.findOne({ where: { slug } });
    if (slugExists) throw new ConflictException('Store name already taken — try a different name');

    // Auto-approve: create schema and activate immediately for POC
    const schemaName = `tenant_${slug.replace(/-/g, '_')}`;

    const tenant = this.tenantRepo.create({
      name: dto.name,
      ownerName: dto.ownerName,
      email: dto.email,
      phone: dto.phone,
      category: dto.category,
      slug,
      status: 'PENDING',   // activated after phone OTP verification
      schemaName,
    });
    const saved = await this.tenantRepo.save(tenant);

    // Create the vendor's PostgreSQL schema and tables
    await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    await this.dataSource.query(`GRANT ALL ON SCHEMA "${schemaName}" TO quickstore`);
    await this.runTenantMigrations(schemaName);
    await this.dataSource.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA "${schemaName}" TO quickstore`);
    await this.dataSource.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "${schemaName}" TO quickstore`);

    // Default GROWTH feature flags
    const defaultFeatures = ['PRODUCTS','CATEGORIES','ORDERS','SEARCH','DELIVERY_TRACKING','DISCOUNTS','CUSTOMER_ACCOUNTS','MULTI_THEME'];
    const requested = dto.requestedFeatures?.length ? dto.requestedFeatures : defaultFeatures;
    const flags = requested.map((feature) =>
      this.featureFlagRepo.create({ tenantId: saved.id, feature, enabled: true, enabledAt: new Date() }),
    );
    if (flags.length) await this.featureFlagRepo.save(flags);

    // Create vendor user account with the password they chose
    await this.authService.createVendorUser(dto.email, dto.password, saved.id, 'VENDOR_OWNER');

    // Log onboarding request as approved
    const request = this.onboardingRepo.create({
      tenantId: saved.id,
      requestedFeatures: requested,
      storeDescription: dto.storeDescription ?? null,
      status: 'APPROVED',
    });
    await this.onboardingRepo.save(request);

    // Send OTP to vendor's phone to verify and activate the store
    await this.authService.sendSignupOtp(dto.phone);

    return {
      message: 'Account created! Enter the OTP sent to your phone to activate your store.',
      tenantId: saved.id,
      slug: saved.slug,
      phone: dto.phone,
      requiresOtp: true,
    };
  }

  // ─── Admin: approve ───────────────────────────────────────────────────────────

  async approveTenant(id: string, featureKeys: string[] = [], reviewedBy?: string) {
    const tenant = await this.tenantRepo.findOneBy({ id });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (tenant.status === 'ACTIVE') throw new BadRequestException('Tenant is already active');

    // Build schema name from slug
    const schemaName = `tenant_${tenant.slug.replace(/-/g, '_')}`;

    // Create PostgreSQL schema
    await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    // Run tenant-scoped table DDL inside the new schema
    await this.runTenantMigrations(schemaName);

    // Update tenant record
    tenant.status = 'ACTIVE';
    tenant.schemaName = schemaName;
    await this.tenantRepo.save(tenant);

    // Create feature flags
    if (featureKeys.length) {
      const flags = featureKeys.map((feature) =>
        this.featureFlagRepo.create({
          tenantId: id,
          feature,
          enabled: true,
          enabledAt: new Date(),
        }),
      );
      await this.featureFlagRepo.save(flags);
    }

    // Update onboarding request
    const request = await this.onboardingRepo.findOne({ where: { tenantId: id, status: 'PENDING' } });
    if (request) {
      request.status = 'APPROVED';
      request.reviewedBy = reviewedBy ?? null;
      request.reviewedAt = new Date();
      await this.onboardingRepo.save(request);
    }

    // Create the vendor user account
    const tmpPassword = `Qs@${Math.random().toString(36).slice(2, 10)}`;
    await this.authService.createVendorUser(tenant.email, tmpPassword, tenant.id, 'VENDOR_OWNER');

    return {
      message: 'Tenant approved and activated',
      schemaName,
      tempPassword: tmpPassword, // In production: send via email
    };
  }

  // ─── Admin: reject ────────────────────────────────────────────────────────────

  async rejectTenant(id: string, notes: string, reviewedBy?: string) {
    const tenant = await this.tenantRepo.findOneBy({ id });
    if (!tenant) throw new NotFoundException('Tenant not found');

    tenant.status = 'REJECTED';
    await this.tenantRepo.save(tenant);

    const request = await this.onboardingRepo.findOne({ where: { tenantId: id, status: 'PENDING' } });
    if (request) {
      request.status = 'REJECTED';
      request.notes = notes;
      request.reviewedBy = reviewedBy ?? null;
      request.reviewedAt = new Date();
      await this.onboardingRepo.save(request);
    }

    return { message: 'Tenant rejected', tenantId: id };
  }

  // ─── Vendor: get own config ───────────────────────────────────────────────────

  async getMyConfig(tenantId: string) {
    const tenant = await this.tenantRepo.findOneBy({ id: tenantId });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const flags = await this.featureFlagRepo.find({ where: { tenantId } });

    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      ownerName: tenant.ownerName,
      email: tenant.email,
      phone: tenant.phone,
      category: tenant.category,
      status: tenant.status,
      plan: tenant.plan,
      schemaName: tenant.schemaName,
      features: flags.reduce<Record<string, boolean>>((acc, f) => {
        acc[f.feature] = f.enabled;
        return acc;
      }, {}),
    };
  }

  async updateMyConfig(tenantId: string, updates: Partial<Pick<Tenant, 'name' | 'ownerName' | 'phone' | 'category'>>) {
    const tenant = await this.tenantRepo.findOneBy({ id: tenantId });
    if (!tenant) throw new NotFoundException('Tenant not found');
    Object.assign(tenant, updates);
    return this.tenantRepo.save(tenant);
  }

  // ─── Admin: lists ─────────────────────────────────────────────────────────────

  async getAllTenants() {
    return this.tenantRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getAllOnboardingRequests() {
    return this.onboardingRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getTenantFeatures(tenantId: string) {
    return this.featureFlagRepo.find({ where: { tenantId } });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private buildSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);
  }

  private async runTenantMigrations(schemaName: string): Promise<void> {
    const s = `"${schemaName}"`;

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS ${s}.products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        price NUMERIC(10,2) NOT NULL DEFAULT 0,
        mrp NUMERIC(10,2),
        stock INTEGER NOT NULL DEFAULT 0,
        unit VARCHAR(30),
        category_id UUID,
        is_active BOOLEAN NOT NULL DEFAULT true,
        images TEXT[] DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS ${s}.categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL,
        slug VARCHAR(160) NOT NULL,
        parent_id UUID,
        image_url TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS ${s}.customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150),
        phone VARCHAR(20) UNIQUE NOT NULL,
        email VARCHAR(150),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS ${s}.addresses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL REFERENCES ${s}.customers(id) ON DELETE CASCADE,
        label VARCHAR(50),
        line1 TEXT NOT NULL,
        line2 TEXT,
        city VARCHAR(100),
        pincode VARCHAR(10),
        lat NUMERIC(10,7),
        lng NUMERIC(10,7),
        is_default BOOLEAN NOT NULL DEFAULT false
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS ${s}.orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number VARCHAR(30) UNIQUE NOT NULL,
        customer_id UUID NOT NULL,
        address_id UUID,
        status VARCHAR(30) NOT NULL DEFAULT 'PLACED',
        subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
        discount_amt NUMERIC(10,2) NOT NULL DEFAULT 0,
        delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
        total NUMERIC(10,2) NOT NULL DEFAULT 0,
        payment_mode VARCHAR(20) NOT NULL DEFAULT 'COD',
        payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS ${s}.order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES ${s}.orders(id) ON DELETE CASCADE,
        product_id UUID NOT NULL,
        product_name VARCHAR(200) NOT NULL,
        price NUMERIC(10,2) NOT NULL,
        quantity INTEGER NOT NULL,
        subtotal NUMERIC(10,2) NOT NULL
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS ${s}.delivery_agents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS ${s}.deliveries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES ${s}.orders(id) ON DELETE CASCADE,
        agent_id UUID REFERENCES ${s}.delivery_agents(id),
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        estimated_time INTEGER,
        notes TEXT,
        assigned_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS ${s}.discounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) UNIQUE NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'PERCENTAGE',
        value NUMERIC(10,2) NOT NULL,
        min_order_amt NUMERIC(10,2) NOT NULL DEFAULT 0,
        max_discount NUMERIC(10,2),
        usage_limit INTEGER,
        used_count INTEGER NOT NULL DEFAULT 0,
        valid_from TIMESTAMPTZ,
        valid_until TIMESTAMPTZ,
        is_active BOOLEAN NOT NULL DEFAULT true
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS ${s}.storefront_config (
        id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        theme              VARCHAR(30)      NOT NULL DEFAULT 'QUICKCART',
        logo_url           TEXT,
        banner_url         TEXT,
        primary_color      VARCHAR(7)       NOT NULL DEFAULT '#16a34a',
        store_name         VARCHAR(100),
        tagline            VARCHAR(200),
        contact_phone      VARCHAR(15),
        contact_email      VARCHAR(150),
        delivery_radius_km INTEGER          DEFAULT 5,
        min_order_amt      DECIMAL(10,2)    DEFAULT 0,
        delivery_fee       DECIMAL(10,2)    DEFAULT 0,
        free_delivery_above DECIMAL(10,2),
        updated_at         TIMESTAMP        NOT NULL DEFAULT NOW()
      )
    `);

    // Seed a default config row so UPDATE queries always find one row
    await this.dataSource.query(`
      INSERT INTO ${s}.storefront_config (theme, store_name, primary_color)
      VALUES ('QUICKCART', 'My Store', '#16a34a')
      ON CONFLICT DO NOTHING
    `);
  }
}
