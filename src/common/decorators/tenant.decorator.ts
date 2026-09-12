import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentTenant = createParamDecorator(
  (data: 'id' | 'slug' | 'schema', ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (data === 'id') return request.tenantId;
    if (data === 'slug') return request.tenantSlug;
    if (data === 'schema') return request.tenantSchemaName;
    return { id: request.tenantId, slug: request.tenantSlug, schema: request.tenantSchemaName };
  },
);
