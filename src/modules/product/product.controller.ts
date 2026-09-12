import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';

class UpdateStockDto {
  qty: number;
}

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiOperation({ summary: 'List products for the tenant store (paginated, searchable)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  findAll(
    @CurrentTenant('schema') schemaName: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.productService.findAll(schemaName, +page, +limit, search, categoryId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single product by ID' })
  findOne(@CurrentTenant('schema') schemaName: string, @Param('id') id: string) {
    return this.productService.findOne(schemaName, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  create(@CurrentTenant('schema') schemaName: string, @Body() dto: CreateProductDto) {
    return this.productService.create(schemaName, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update product details' })
  update(
    @CurrentTenant('schema') schemaName: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateProductDto>,
  ) {
    return this.productService.update(schemaName, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a product (sets isActive=false)' })
  remove(@CurrentTenant('schema') schemaName: string, @Param('id') id: string) {
    return this.productService.remove(schemaName, id);
  }

  @Patch(':id/stock')
  @ApiOperation({ summary: 'Adjust product stock (positive = add, negative = subtract)' })
  updateStock(
    @CurrentTenant('schema') schemaName: string,
    @Param('id') id: string,
    @Body() dto: UpdateStockDto,
  ) {
    return this.productService.updateStock(schemaName, id, dto.qty);
  }
}
