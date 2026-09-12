import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CustomerOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  phone: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  otp: string;
}
