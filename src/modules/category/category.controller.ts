import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CategoryService, CreateCategoryDto } from './category.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({ summary: 'List active categories for the tenant store (paginated, searchable, sortable)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'name | sortOrder | productCount' })
  @ApiQuery({ name: 'sortDir', required: false, type: String, description: 'asc | desc' })
  findAll(
    @CurrentTenant('schema') schemaName: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.categoryService.findAll(schemaName, +page, +limit, search, sortBy, sortDir);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new category' })
  create(@CurrentTenant('schema') schemaName: string, @Body() dto: CreateCategoryDto) {
    return this.categoryService.create(schemaName, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update category details' })
  update(
    @CurrentTenant('schema') schemaName: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateCategoryDto>,
  ) {
    return this.categoryService.update(schemaName, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a category (soft delete)' })
  remove(@CurrentTenant('schema') schemaName: string, @Param('id') id: string) {
    return this.categoryService.remove(schemaName, id);
  }
}
