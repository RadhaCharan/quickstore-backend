import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CustomerOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('vendor/login')
  @ApiOperation({ summary: 'Vendor login with email and password' })
  vendorLogin(@Body() dto: LoginDto) {
    return this.authService.vendorLogin(dto);
  }

  @Public()
  @Post('vendor/refresh')
  @ApiOperation({ summary: 'Refresh vendor access token' })
  refresh(@Body('refreshToken') token: string) {
    return this.authService.refreshToken(token);
  }

  @Public()
  @Post('customer/send-otp')
  @ApiOperation({ summary: 'Send OTP to customer phone' })
  sendOtp(@Body() dto: CustomerOtpDto, @Req() req: any) {
    return this.authService.sendOtp(dto, req.tenantId);
  }

  @Public()
  @Post('customer/verify-otp')
  @ApiOperation({ summary: 'Verify OTP and get customer token' })
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: any) {
    return this.authService.verifyOtp(dto, req.tenantId);
  }
}
