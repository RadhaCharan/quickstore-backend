import {
  Controller, Get, Patch, Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { StorefrontService } from './storefront.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';

@ApiTags('Storefront')
@Controller('storefront')
export class StorefrontController {
  constructor(private readonly storefrontService: StorefrontService) {}

  // ─── Vendor Routes ────────────────────────────────────────────────────────────

  @UseGuards(JwtGuard)
  @Get('config')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[VENDOR] Get own storefront configuration' })
  getConfig(@CurrentTenant('schema') schemaName: string, @Request() req: any) {
    return this.storefrontService.getStorefrontConfig(req.user.tenantId, schemaName);
  }

  @UseGuards(JwtGuard)
  @Patch('config')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[VENDOR] Update storefront config + feature flags' })
  updateConfig(
    @CurrentTenant('schema') schemaName: string,
    @Request() req: any,
    @Body() updates: Record<string, any>,
  ) {
    return this.storefrontService.updateStorefrontConfig(req.user.tenantId, schemaName, updates);
  }

  // ─── Public Routes ────────────────────────────────────────────────────────────

  @Public()
  @Get(':slug/bootstrap')
  @ApiOperation({ summary: '[PUBLIC] Single bootstrap call — store info + theme + categories + products' })
  getBootstrap(@Param('slug') slug: string) {
    return this.storefrontService.getBootstrap(slug);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: '[PUBLIC] Get public storefront page (tenant info + featured products)' })
  getPublicStorefront(@Param('slug') slug: string) {
    return this.storefrontService.getPublicStorefront(slug);
  }

  @Public()
  @Get(':slug/products/:productId')
  @ApiOperation({ summary: '[PUBLIC] Get single product detail' })
  getPublicProduct(@Param('slug') slug: string, @Param('productId') productId: string) {
    return this.storefrontService.getPublicProduct(slug, productId);
  }

  @Public()
  @Get(':slug/products')
  @ApiOperation({ summary: '[PUBLIC] Browse products in a store' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  getPublicProducts(
    @Param('slug') slug: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.storefrontService.getPublicProducts(slug, +page, +limit, search, categoryId);
  }

  @Public()
  @Get(':slug/categories')
  @ApiOperation({ summary: '[PUBLIC] Browse categories in a store' })
  getPublicCategories(@Param('slug') slug: string) {
    return this.storefrontService.getPublicCategories(slug);
  }
}
