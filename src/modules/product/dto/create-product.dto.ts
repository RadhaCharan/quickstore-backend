import {
  IsString, IsNotEmpty, IsNumber, IsOptional, IsInt, IsArray, Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @ApiProperty({ example: 'Toor Dal 1kg' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Premium quality toor dal sourced from farmers.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 120 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiPropertyOptional({ example: 140 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  mrp?: number;

  @ApiProperty({ example: 50 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stock: number;

  @ApiPropertyOptional({ example: 'kg' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ description: 'UUID of the category' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ type: [String], example: ['https://cdn.example.com/img1.jpg'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}
