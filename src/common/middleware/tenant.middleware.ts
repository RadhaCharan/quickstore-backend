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

    let slug: string | undefined;

    if (headerSlug) {
      slug = headerSlug;
    } else {
      const parts = host.split('.');
      if (parts.length >= 3) slug = parts[0];
    }

    if (!slug) return next();

    const rows = await this.dataSource.query(
      `SELECT id, slug, schema_name FROM platform.tenants WHERE slug = $1 AND status = 'ACTIVE' LIMIT 1`,
      [slug],
    );

    if (!rows.length) {
      throw new NotFoundException(`Store '${slug}' not found or inactive`);
    }

    req.tenantId = rows[0].id;
    req.tenantSlug = rows[0].slug;
    req.tenantSchemaName = rows[0].schema_name;

    next();
  }
}
