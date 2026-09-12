import {
  Controller, Get, Post, Patch, Delete, Param, Body, Headers, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { DiscountService, CreateDiscountDto } from './discount.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';

class ApplyDiscountDto {
  code: string;
  orderAmount: number;
}

@ApiTags('Discounts')
@Controller('discounts')
export class DiscountController {
  constructor(private readonly discountService: DiscountService) {}

  // ─── Customer (public with X-Tenant-Slug) ────────────────────────────────────

  @Public()
  @Post('apply')
  @ApiOperation({ summary: '[PUBLIC] Apply a coupon code — requires X-Tenant-Slug header' })
  @ApiHeader({ name: 'X-Tenant-Slug', description: 'Tenant slug to scope the discount lookup' })
  applyDiscount(
    @CurrentTenant('schema') schemaName: string,
    @Body() dto: ApplyDiscountDto,
  ) {
    return this.discountService.applyDiscount(schemaName, dto.code, dto.orderAmount);
  }

  // ─── Vendor ───────────────────────────────────────────────────────────────────

  @UseGuards(JwtGuard)
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: '[VENDOR] List all discount codes' })
  listDiscounts(@CurrentTenant('schema') schemaName: string) {
    return this.discountService.listDiscounts(schemaName);
  }

  @UseGuards(JwtGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: '[VENDOR] Create a new discount code' })
  createDiscount(@CurrentTenant('schema') schemaName: string, @Body() dto: CreateDiscountDto) {
    return this.discountService.createDiscount(schemaName, dto);
  }

  @UseGuards(JwtGuard)
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[VENDOR] Update a discount code' })
  updateDiscount(
    @CurrentTenant('schema') schemaName: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateDiscountDto>,
  ) {
    return this.discountService.updateDiscount(schemaName, id, dto);
  }

  @UseGuards(JwtGuard)
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[VENDOR] Deactivate a discount code' })
  deactivateDiscount(@CurrentTenant('schema') schemaName: string, @Param('id') id: string) {
    return this.discountService.deactivateDiscount(schemaName, id);
  }
}
