import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';

export interface TenantRequest extends Request {
  tenantId: string;
  tenantSlug: string;
  tenantSchemaName: string;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly dataSource: DataSource) {}

  async use(req: TenantRequest, res: Response, next: NextFunction) {
    const host = (req.hostname || (req.headers.host as string) || '').split(':')[0];
    const headerSlug = req.headers['x-tenant-slug'] as string;
    const baseDomain = process.env.BASE_DOMAIN || 'quickstore.in';

    // Hosts where subdomain-based tenant resolution must NOT apply
    const isSystemHost = host.endsWith('.run.app') ||
      host.endsWith('.cloudfunctions.net') ||
      host === 'localhost' ||
      host.startsWith('127.');

    let slug: string | undefined;

    if (headerSlug) {
      slug = headerSlug;
    } else if (!isSystemHost && host.endsWith(`.${baseDomain}`)) {
      // Only extract tenant from subdomain on the production domain (e.g. mystore.quickstore.in)
      const parts = host.split('.');
      if (parts.length >= 3) slug = parts[0];
    }

    if (!slug) return next();

    // Storefront (public) routes require ACTIVE tenant.
    // Vendor/admin routes (header-based slug) allow PENDING too so vendors
    // can access their dashboard immediately after signup.
    const isHeaderSlug = !!headerSlug;
    const statusFilter = isHeaderSlug
      ? `status IN ('ACTIVE', 'PENDING', 'APPROVED')`
      : `status = 'ACTIVE'`;

    const rows = await this.dataSource.query(
      `SELECT id, slug, schema_name FROM platform.tenants WHERE slug = $1 AND ${statusFilter} LIMIT 1`,
      [slug],
    );

    if (!rows.length) {
      if (isHeaderSlug) return next(); // vendor JWT will handle auth; don't block
      throw new NotFoundException(`Store '${slug}' not found or inactive`);
    }

    req.tenantId = rows[0].id;
    req.tenantSlug = rows[0].slug;
    req.tenantSchemaName = rows[0].schema_name;

    next();
  }
}
