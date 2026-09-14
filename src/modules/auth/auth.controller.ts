import { Controller, Post, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CustomerOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { Public } from '../../common/decorators/public.decorator';

class PhoneDto {
  @IsString() phone: string;
}
class PhoneOtpDto {
  @IsString() phone: string;
  @IsString() @Length(6, 6) otp: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Vendor: email + password ─────────────────────────────────────────────

  @Public()
  @Post('vendor/login')
  @ApiOperation({ summary: 'Vendor login — email + password' })
  vendorLogin(@Body() dto: LoginDto) {
    return this.authService.vendorLogin(dto);
  }

  @Public()
  @Post('vendor/refresh')
  @ApiOperation({ summary: 'Refresh vendor access token' })
  refresh(@Body('refreshToken') token: string) {
    return this.authService.refreshToken(token);
  }

  // ─── Vendor: phone OTP login ───────────────────────────────────────────────

  @Public()
  @Post('vendor/otp/send')
  @ApiOperation({ summary: 'Send OTP to vendor registered phone (for login)' })
  @ApiBody({ type: PhoneDto })
  sendVendorLoginOtp(@Body() body: PhoneDto) {
    return this.authService.sendVendorLoginOtp(body.phone);
  }

  @Public()
  @Post('vendor/otp/verify')
  @ApiOperation({ summary: 'Verify OTP and log in as vendor (passwordless)' })
  @ApiBody({ type: PhoneOtpDto })
  verifyVendorLoginOtp(@Body() body: PhoneOtpDto) {
    return this.authService.verifyVendorLoginOtp(body.phone, body.otp);
  }

  // ─── Vendor: signup phone activation ─────────────────────────────────────

  @Public()
  @Post('vendor/signup/send-otp')
  @ApiOperation({ summary: 'Send OTP to phone after signup (activates store on verify)' })
  @ApiBody({ type: PhoneDto })
  sendSignupOtp(@Body() body: PhoneDto) {
    return this.authService.sendSignupOtp(body.phone);
  }

  @Public()
  @Post('vendor/signup/verify-otp')
  @ApiOperation({ summary: 'Verify OTP to activate vendor store after signup' })
  @ApiBody({ type: PhoneOtpDto })
  activateVendorByOtp(@Body() body: PhoneOtpDto) {
    return this.authService.activateVendorByOtp(body.phone, body.otp);
  }

  // ─── Customer: phone OTP login (on vendor storefront) ─────────────────────

  @Public()
  @Post('customer/send-otp')
  @ApiOperation({ summary: 'Send OTP to customer phone' })
  sendCustomerOtp(@Body() dto: CustomerOtpDto) {
    return this.authService.sendCustomerOtp(dto);
  }

  @Public()
  @Post('customer/verify-otp')
  @ApiOperation({ summary: 'Verify OTP and get customer access token' })
  verifyCustomerOtp(@Body() dto: VerifyOtpDto, @Req() req: any) {
    return this.authService.verifyCustomerOtp(dto, req.tenantId);
  }
}
