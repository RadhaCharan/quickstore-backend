import {
  Controller, Get, Patch, Post, Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import {
  CustomerService,
  UpdateCustomerDto,
  CreateAddressDto,
} from './customer.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  // ─── Vendor Routes ────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: '[VENDOR] List all customers (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  getAllCustomers(
    @CurrentTenant('schema') schemaName: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.customerService.getAllCustomers(schemaName, +page, +limit, search);
  }

  @Get(':id')
  @ApiOperation({ summary: '[VENDOR] Get customer details with addresses' })
  getCustomerById(@CurrentTenant('schema') schemaName: string, @Param('id') id: string) {
    return this.customerService.getCustomerById(schemaName, id);
  }

  // ─── Customer Self-service Routes ─────────────────────────────────────────────

  @Get('me/profile')
  @ApiOperation({ summary: '[CUSTOMER] Get own profile' })
  getMe(@CurrentTenant('schema') schemaName: string, @Request() req: any) {
    // req.user.sub is the phone number from customer JWT
    return this.customerService.getMe(schemaName, req.user.sub);
  }

  @Patch('me/profile')
  @ApiOperation({ summary: '[CUSTOMER] Update own profile' })
  updateMe(
    @CurrentTenant('schema') schemaName: string,
    @Request() req: any,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customerService.updateMe(schemaName, req.user.sub, dto);
  }

  @Get('me/addresses')
  @ApiOperation({ summary: '[CUSTOMER] Get own saved addresses' })
  getAddresses(@CurrentTenant('schema') schemaName: string, @Request() req: any) {
    return this.customerService.getAddresses(schemaName, req.user.sub);
  }

  @Post('me/addresses')
  @ApiOperation({ summary: '[CUSTOMER] Add a new delivery address' })
  addAddress(
    @CurrentTenant('schema') schemaName: string,
    @Request() req: any,
    @Body() dto: CreateAddressDto,
  ) {
    return this.customerService.addAddress(schemaName, req.user.sub, dto);
  }

  @Patch('me/addresses/:id')
  @ApiOperation({ summary: '[CUSTOMER] Update a saved address' })
  updateAddress(
    @CurrentTenant('schema') schemaName: string,
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<CreateAddressDto>,
  ) {
    return this.customerService.updateAddress(schemaName, req.user.sub, id, dto);
  }
}
