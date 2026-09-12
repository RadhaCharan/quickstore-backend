import {
  Injectable, UnauthorizedException, BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { PlatformUser } from './entities/platform-user.entity';
import { LoginDto } from './dto/login.dto';
import { CustomerOtpDto, VerifyOtpDto } from './dto/otp.dto';

@Injectable()
export class AuthService {
  // In production use Redis for OTPs; Map is for POC only
  private otpStore = new Map<string, { otp: string; expires: Date }>();

  constructor(
    @InjectRepository(PlatformUser)
    private readonly userRepo: Repository<PlatformUser>,
    private readonly jwtService: JwtService,
    private readonly cfg: ConfigService,
  ) {}

  async vendorLogin(dto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
      relations: ['tenant'],
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (user.tenant && user.tenant.status !== 'ACTIVE') {
      throw new UnauthorizedException('Your store is not yet active');
    }

    return this.issueTokens(user);
  }

  async sendOtp(dto: CustomerOtpDto, tenantId: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    this.otpStore.set(`${tenantId}:${dto.phone}`, { otp, expires });

    // In production: send via SMS gateway (Twilio, MSG91)
    console.log(`OTP for ${dto.phone}: ${otp}`);

    const isDev = this.cfg.get('NODE_ENV') === 'development';
    return {
      message: 'OTP sent successfully',
      ...(isDev && { otp }), // dev-only: skip SMS gateway and hand back the code directly
    };
  }

  async verifyOtp(dto: VerifyOtpDto, tenantId: string) {
    const key = `${tenantId}:${dto.phone}`;
    const stored = this.otpStore.get(key);

    if (!stored || stored.otp !== dto.otp || stored.expires < new Date()) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    this.otpStore.delete(key);

    const payload = { sub: dto.phone, role: 'CUSTOMER', tenantId, type: 'customer' };
    const token = this.jwtService.sign(payload, { expiresIn: '30d' });
    return { accessToken: token, phone: dto.phone };
  }

  async createVendorUser(email: string, password: string, tenantId: string, role = 'VENDOR_OWNER') {
    const hash = await bcrypt.hash(password, 12);
    const user = this.userRepo.create({ email, passwordHash: hash, tenantId, role });
    return this.userRepo.save(user);
  }

  private issueTokens(user: PlatformUser) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      type: 'vendor',
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.cfg.get('JWT_REFRESH_SECRET'),
      expiresIn: this.cfg.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    return { accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role } };
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.cfg.get('JWT_REFRESH_SECRET'),
      });
      const user = await this.userRepo.findOneBy({ id: payload.sub });
      if (!user) throw new UnauthorizedException();
      return this.issueTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
