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

class AddressInputDto {
  @ApiProperty({ example: 'House no. 4, MG Road' })
  @IsString()
  @IsNotEmpty()
  line1: string;

  @ApiPropertyOptional({ example: 'Near the temple' })
  @IsOptional()
  @IsString()
  line2?: string;

  @ApiProperty({ example: 'Pune' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiPropertyOptional({ example: '411001' })
  @IsOptional()
  @IsString()
  pincode?: string;
}

export class CreateOrderDto {
  @ApiPropertyOptional({ description: 'Saved customer address UUID — omit and send `address` instead for a one-off address' })
  @IsOptional()
  @IsUUID()
  addressId?: string;

  @ApiPropertyOptional({ type: AddressInputDto, description: 'Inline delivery address — used when addressId is not provided. Saved to the customer\'s address book.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressInputDto)
  address?: AddressInputDto;

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

  @ApiPropertyOptional({ example: 'Ramesh Kumar', description: "Saved to the customer's profile — checkout is usually the only place a customer's name is ever collected" })
  @IsOptional()
  @IsString()
  customerName?: string;
}
