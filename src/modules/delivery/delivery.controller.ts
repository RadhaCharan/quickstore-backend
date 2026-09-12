import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import {
  DeliveryService,
  CreateAgentDto,
  AssignDeliveryDto,
  UpdateDeliveryStatusDto,
} from './delivery.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';

@ApiTags('Delivery')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  // ─── Agents ───────────────────────────────────────────────────────────────────

  @Get('agents')
  @ApiOperation({ summary: 'List all active delivery agents' })
  getAgents(@CurrentTenant('schema') schemaName: string) {
    return this.deliveryService.getAgents(schemaName);
  }

  @Post('agents')
  @ApiOperation({ summary: 'Add a new delivery agent' })
  createAgent(@CurrentTenant('schema') schemaName: string, @Body() dto: CreateAgentDto) {
    return this.deliveryService.createAgent(schemaName, dto);
  }

  @Patch('agents/:id')
  @ApiOperation({ summary: 'Update delivery agent details' })
  updateAgent(
    @CurrentTenant('schema') schemaName: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateAgentDto>,
  ) {
    return this.deliveryService.updateAgent(schemaName, id, dto);
  }

  // ─── Deliveries ───────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all deliveries (with agent info)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  getDeliveries(
    @CurrentTenant('schema') schemaName: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    return this.deliveryService.getDeliveries(schemaName, +page, +limit, status);
  }

  @Patch(':orderId/assign')
  @ApiOperation({ summary: 'Assign a delivery agent to an order' })
  assignDelivery(
    @CurrentTenant('schema') schemaName: string,
    @Param('orderId') orderId: string,
    @Body() dto: AssignDeliveryDto,
  ) {
    return this.deliveryService.assignDelivery(schemaName, orderId, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update delivery status (by agent or vendor)' })
  updateStatus(
    @CurrentTenant('schema') schemaName: string,
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    return this.deliveryService.updateDeliveryStatus(schemaName, id, dto);
  }
}
