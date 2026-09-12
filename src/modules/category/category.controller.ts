import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'List all active categories for the tenant store' })
  findAll(@CurrentTenant('schema') schemaName: string) {
    return this.categoryService.findAll(schemaName);
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
