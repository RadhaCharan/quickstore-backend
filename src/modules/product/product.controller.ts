import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException, Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import type { Response } from 'express';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';

class UpdateStockDto {
  @IsNumber()
  @Type(() => Number)
  qty: number;
}

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiOperation({ summary: 'List products for the tenant store (paginated, searchable, sortable)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'name | price | mrp | stock | status | category | createdAt' })
  @ApiQuery({ name: 'sortDir', required: false, type: String, description: 'asc | desc' })
  findAll(
    @CurrentTenant('schema') schemaName: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.productService.findAll(schemaName, +page, +limit, search, categoryId, sortBy, sortDir);
  }

  // NOTE: these two literal routes must stay ahead of the `:id` route below, or Express
  // will treat "bulk-import" itself as the :id param.
  @Public()
  @Get('bulk-import/template')
  @ApiOperation({ summary: 'Download a sample CSV template for bulk product import' })
  downloadTemplate(@Res() res: Response) {
    const csv = [
      'name,description,price,mrp,stock,unit,category',
      'Amul Milk 500ml,Fresh full-cream milk,32,35,100,500 ml,Dairy',
      'Toor Dal 1kg,Premium quality toor dal sourced from farmers,120,140,50,1 kg,Groceries',
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="product-import-template.csv"');
    res.send(csv);
  }

  @Post('bulk-import')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Bulk-create products from a CSV file (columns: name, description, price, mrp, stock, unit, category)' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
  bulkImport(
    @CurrentTenant('schema') schemaName: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded — attach a CSV as "file"');
    return this.productService.bulkImport(schemaName, file.buffer.toString('utf-8'));
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
