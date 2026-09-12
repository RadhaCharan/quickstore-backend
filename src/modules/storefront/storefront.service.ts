import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { FeatureFlag } from '../tenant/entities/feature-flag.entity';

@Injectable()
export class StorefrontService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,

    @InjectRepository(FeatureFlag)
    private readonly featureFlagRepo: Repository<FeatureFlag>,

    private readonly dataSource: DataSource,
  ) {}

  // ─── Bootstrap (single call — everything the storefront needs on first paint) ──

  async getBootstrap(slug: string) {
    const tenant = await this.tenantRepo.findOne({ where: { slug, status: 'ACTIVE' } });
    if (!tenant) throw new NotFoundException(`Store "${slug}" not found`);

    const s = `"${tenant.schemaName}"`;
    const flags = await this.featureFlagRepo.find({ where: { tenantId: tenant.id, enabled: true } });
    const features = flags.map((f) => f.feature);

    const [[configRow], categories, featuredProducts] = await Promise.all([
      this.dataSource.query(
        `SELECT theme, logo_url, banner_url, primary_color, store_name, tagline,
                contact_phone, delivery_fee, min_order_amt, free_delivery_above
         FROM ${s}.storefront_config LIMIT 1`,
      ).catch(() => [null]),

      this.dataSource.query(
        `SELECT id, name, slug, image_url,
                (SELECT COUNT(*) FROM ${s}.products p WHERE p.category_id = c.id AND p.is_active = true)::int AS product_count
         FROM ${s}.categories c WHERE c.is_active = true ORDER BY c.sort_order, c.name LIMIT 20`,
      ).catch(() => []),

      this.dataSource.query(
        `SELECT id, name, description, price, mrp, stock, unit, images, category_id
         FROM ${s}.products WHERE is_active = true ORDER BY created_at DESC LIMIT 12`,
      ).catch(() => []),
    ]);

    const theme = configRow?.theme?.toLowerCase() || 'quickcart';

    return {
      store: {
        id: tenant.id,
        slug: tenant.slug,
        storeName: configRow?.store_name || tenant.name,
        tagline: configRow?.tagline || 'Fresh products delivered fast',
        logoUrl: configRow?.logo_url || null,
        bannerUrl: configRow?.banner_url || null,
        contactPhone: configRow?.contact_phone || tenant.phone,
        category: tenant.category,
      },
      theme: {
        key: theme,
        primaryColor: configRow?.primary_color || '#16a34a',
      },
      delivery: {
        fee: Number(configRow?.delivery_fee || 0),
        minOrderAmount: Number(configRow?.min_order_amt || 0),
        freeAbove: configRow?.free_delivery_above ? Number(configRow.free_delivery_above) : null,
      },
      features,
      categories: categories.map((c: any) => ({
        id: c.id, name: c.name, slug: c.slug,
        imageUrl: c.image_url, productCount: c.product_count,
      })),
      featuredProducts: featuredProducts.map((p: any) => ({
        id: p.id, name: p.name, description: p.description,
        price: Number(p.price), mrp: p.mrp ? Number(p.mrp) : null,
        stock: p.stock, unit: p.unit,
        images: p.images || [],
        inStock: p.stock > 0,
        discountPct: p.mrp && p.mrp > p.price
          ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : null,
        categoryId: p.category_id,
      })),
    };
  }

  // ─── Public ───────────────────────────────────────────────────────────────────

  async getPublicStorefront(slug: string) {
    const tenant = await this.tenantRepo.findOne({ where: { slug, status: 'ACTIVE' } });
    if (!tenant) throw new NotFoundException(`Store "${slug}" not found or is not active`);

    const s = `"${tenant.schemaName}"`;

    const flags = await this.featureFlagRepo.find({ where: { tenantId: tenant.id, enabled: true } });

    const [configRow] = await this.dataSource.query(
      `SELECT theme, logo_url, banner_url, primary_color, store_name, tagline,
              contact_phone, contact_email, delivery_radius_km,
              min_order_amt, delivery_fee, free_delivery_above
       FROM ${s}.storefront_config LIMIT 1`,
    ).catch(() => [null]);

    const featuredProducts = await this.dataSource.query(
      `SELECT id, name, price, mrp, images, unit, stock
       FROM ${s}.products
       WHERE is_active = true
       ORDER BY created_at DESC
       LIMIT 8`,
    ).catch(() => []);

    return {
      store: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        category: tenant.category,
        plan: tenant.plan,
      },
      features: flags.map((f) => f.feature),
      config: {
        theme: configRow?.theme || 'QUICKCART',
        logoUrl: configRow?.logo_url || null,
        bannerUrl: configRow?.banner_url || null,
        primaryColor: configRow?.primary_color || '#16a34a',
        storeName: configRow?.store_name || tenant.name,
        tagline: configRow?.tagline || null,
        contactPhone: configRow?.contact_phone || tenant.phone,
        contactEmail: configRow?.contact_email || tenant.email,
        deliveryRadiusKm: configRow?.delivery_radius_km || 5,
        minOrderAmount: Number(configRow?.min_order_amt || 0),
        deliveryFee: Number(configRow?.delivery_fee || 0),
        freeDeliveryAbove: configRow?.free_delivery_above ? Number(configRow.free_delivery_above) : null,
        enabledFeatures: flags.map((f) => f.feature),
      },
      featuredProducts,
    };
  }

  async getPublicProduct(slug: string, productId: string) {
    const tenant = await this.tenantRepo.findOne({ where: { slug, status: 'ACTIVE' } });
    if (!tenant) throw new NotFoundException(`Store "${slug}" not found`);

    const s = `"${tenant.schemaName}"`;
    const [product] = await this.dataSource.query(
      `SELECT id, name, description, price, mrp, stock, unit, images, category_id, is_active
       FROM ${s}.products WHERE id = $1 AND is_active = true LIMIT 1`,
      [productId],
    );
    if (!product) throw new NotFoundException('Product not found');

    return {
      id: product.id,
      slug: product.id,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      mrp: product.mrp ? Number(product.mrp) : null,
      stock: product.stock,
      unit: product.unit,
      images: product.images || [],
      inStock: product.stock > 0,
      categoryId: product.category_id,
    };
  }

  async getPublicProducts(slug: string, page = 1, limit = 20, search?: string, categoryId?: string) {
    const tenant = await this.tenantRepo.findOne({ where: { slug, status: 'ACTIVE' } });
    if (!tenant) throw new NotFoundException(`Store "${slug}" not found`);

    const s = `"${tenant.schemaName}"`;
    const offset = (page - 1) * limit;
    const params: any[] = [`%${search ?? ''}%`, limit, offset];
    let extra = '';
    if (categoryId) {
      params.push(categoryId);
      extra = `AND category_id = $${params.length}`;
    }

    const rows = await this.dataSource.query(
      `SELECT id, name, description, price, mrp, stock, unit, images, category_id
       FROM ${s}.products
       WHERE is_active = true AND name ILIKE $1 ${extra}
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      params,
    );

    const countParams = categoryId ? [`%${search ?? ''}%`, categoryId] : [`%${search ?? ''}%`];
    const countExtra = categoryId ? `AND category_id = $2` : '';
    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) FROM ${s}.products WHERE is_active = true AND name ILIKE $1 ${countExtra}`,
      countParams,
    );

    return { items: rows, total: Number(count), page, limit };
  }

  async getPublicCategories(slug: string) {
    const tenant = await this.tenantRepo.findOne({ where: { slug, status: 'ACTIVE' } });
    if (!tenant) throw new NotFoundException(`Store "${slug}" not found`);

    const s = `"${tenant.schemaName}"`;
    return this.dataSource.query(
      `SELECT * FROM ${s}.categories WHERE is_active = true ORDER BY sort_order ASC, name ASC`,
    );
  }

  // ─── Vendor ───────────────────────────────────────────────────────────────────

  async getStorefrontConfig(tenantId: string, schemaName: string) {
    const tenant = await this.tenantRepo.findOneBy({ id: tenantId });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const flags = await this.featureFlagRepo.find({ where: { tenantId } });

    const [configRow] = await this.dataSource.query(
      `SELECT theme, logo_url, banner_url, primary_color, store_name, tagline,
              contact_phone, contact_email, delivery_radius_km,
              min_order_amt, delivery_fee, free_delivery_above
       FROM "${schemaName}".storefront_config LIMIT 1`,
    ).catch(() => [null]);

    return {
      tenant,
      features: flags.map((f) => f.feature),
      // The admin Settings form reads/writes camelCase — map the raw snake_case row so a
      // saved config actually reappears after a reload instead of looking reset to defaults.
      config: configRow ? {
        theme: configRow.theme,
        logoUrl: configRow.logo_url,
        bannerUrl: configRow.banner_url,
        primaryColor: configRow.primary_color,
        storeName: configRow.store_name,
        tagline: configRow.tagline,
        contactPhone: configRow.contact_phone,
        contactEmail: configRow.contact_email,
        deliveryRadiusKm: configRow.delivery_radius_km,
        minOrderAmount: configRow.min_order_amt,
        deliveryFee: configRow.delivery_fee,
        freeDeliveryAbove: configRow.free_delivery_above,
      } : {},
    };
  }

  async updateStorefrontConfig(tenantId: string, schemaName: string, updates: Record<string, any>) {
    const s = `"${schemaName}"`;

    // If enabledFeatures is provided, update the feature flags table
    if (Array.isArray(updates.enabledFeatures)) {
      // Remove all existing flags and replace with new selection
      await this.featureFlagRepo.delete({ tenantId });
      if (updates.enabledFeatures.length > 0) {
        const flags = updates.enabledFeatures.map((feature: string) =>
          this.featureFlagRepo.create({ tenantId, feature, enabled: true, enabledAt: new Date() }),
        );
        await this.featureFlagRepo.save(flags);
      }
    }

    // Numeric fields — empty string must become null (not '') for DECIMAL columns
    const NUMERIC_FIELDS = new Set(['minOrderAmount', 'deliveryFee', 'freeDeliveryAbove', 'deliveryRadiusKm']);

    const fieldMap: Record<string, string> = {
      theme: 'theme',
      logoUrl: 'logo_url',
      bannerUrl: 'banner_url',
      primaryColor: 'primary_color',
      storeName: 'store_name',
      tagline: 'tagline',
      contactPhone: 'contact_phone',
      contactEmail: 'contact_email',
      deliveryRadiusKm: 'delivery_radius_km',
      minOrderAmount: 'min_order_amt',
      deliveryFee: 'delivery_fee',
      freeDeliveryAbove: 'free_delivery_above',
    };

    const setClauses: string[] = [];
    const params: any[] = [];

    for (const [key, dbCol] of Object.entries(fieldMap)) {
      if (updates[key] !== undefined) {
        let val = updates[key];
        // Convert empty string to null for numeric columns
        if (NUMERIC_FIELDS.has(key) && (val === '' || val === null)) val = null;
        // Convert numeric strings to numbers
        else if (NUMERIC_FIELDS.has(key) && val !== null) val = Number(val) || 0;
        // Convert empty strings to null for text columns
        else if (typeof val === 'string' && val.trim() === '' && !['theme', 'primaryColor'].includes(key)) val = null;
        params.push(val);
        setClauses.push(`${dbCol} = $${params.length}`);
      }
    }

    if (setClauses.length > 0) {
      params.push(new Date().toISOString());
      await this.dataSource.query(
        `UPDATE ${s}.storefront_config SET ${setClauses.join(', ')}, updated_at = $${params.length}`,
        params,
      );
    }

    return { updated: setClauses.length, features: updates.enabledFeatures?.length ?? 0 };
  }
}
