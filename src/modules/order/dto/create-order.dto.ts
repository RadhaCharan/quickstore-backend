import {
  IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, IsInt, Min, ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class OrderItemDto {
  @ApiProperty({ description: 'Product UUID' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number;
}

export class CreateOrderDto {
  @ApiPropertyOptional({ description: 'Customer address UUID' })
  @IsOptional()
  @IsUUID()
  addressId?: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty({ enum: ['RAZORPAY', 'COD'] })
  @IsEnum(['RAZORPAY', 'COD'])
  paymentMode: 'RAZORPAY' | 'COD';

  @ApiPropertyOptional({ example: 'WELCOME10' })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ example: 'Leave at door' })
  @IsOptional()
  @IsString()
  notes?: string;
}
