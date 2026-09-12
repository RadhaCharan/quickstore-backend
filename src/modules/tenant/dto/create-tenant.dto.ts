import {
  IsEmail, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, MinLength, IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({ example: 'Green Grocer' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Ramesh Kumar' })
  @IsString()
  @IsNotEmpty()
  ownerName: string;

  @ApiProperty({ example: 'ramesh@greengrocer.in' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ example: 'grocery' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'Fresh vegetables and fruits delivered to your door.' })
  @IsOptional()
  @IsString()
  storeDescription?: string;

  @ApiPropertyOptional({ type: [String], example: ['ONLINE_ORDERING', 'LOYALTY'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requestedFeatures?: string[];

  @ApiProperty({ example: 'SuperSecret@123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
