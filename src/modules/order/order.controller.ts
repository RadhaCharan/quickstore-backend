import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';

class UpdateStatusDto {
  @IsIn(['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'])
  status: string;
}

@ApiTags('Orders')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // ─── Customer Routes ──────────────────────────────────────────────────────────

  @UseGuards(JwtGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: '[CUSTOMER] Place a new order' })
  placeOrder(
    @CurrentTenant('schema') schemaName: string,
    @Body() dto: CreateOrderDto,
    @Request() req: any,
  ) {
    // req.user.sub holds customer phone (from OTP login)
    return this.orderService.placeOrder(schemaName, dto, req.user.sub);
  }

  // NOTE: 'mine' must stay ahead of the ':id' route below, or Express will treat
  // "mine" itself as the :id param.
  @UseGuards(JwtGuard)
  @Get('mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: "[CUSTOMER] List my own past orders — never the whole store's" })
  getMine(@CurrentTenant('schema') schemaName: string, @Request() req: any) {
    return this.orderService.getMine(schemaName, req.user.sub);
  }

  @UseGuards(JwtGuard)
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order details by ID' })
  getOne(@CurrentTenant('schema') schemaName: string, @Param('id') id: string) {
    return this.orderService.getOne(schemaName, id);
  }

  // ─── Vendor Routes ────────────────────────────────────────────────────────────

  @UseGuards(JwtGuard)
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: '[VENDOR] List all orders (paginated, filterable by status)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  getAll(
    @CurrentTenant('schema') schemaName: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    return this.orderService.getAll(schemaName, +page, +limit, status);
  }

  @UseGuards(JwtGuard)
  @Patch(':id/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[VENDOR] Update order status' })
  updateStatus(
    @CurrentTenant('schema') schemaName: string,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.orderService.updateStatus(schemaName, id, dto.status);
  }

  @UseGuards(JwtGuard)
  @Get('analytics/summary')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[VENDOR] Get order analytics (total orders, revenue, status breakdown)' })
  getAnalytics(@CurrentTenant('schema') schemaName: string) {
    return this.orderService.getAnalytics(schemaName);
  }

  @UseGuards(JwtGuard)
  @Get('analytics/timeseries')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[VENDOR] Daily orders + revenue for the last N days, for the dashboard charts' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: '7, 30 or 90 (default 30)' })
  getTimeseries(@CurrentTenant('schema') schemaName: string, @Query('days') days = '30') {
    return this.orderService.getTimeseries(schemaName, +days);
  }
}
