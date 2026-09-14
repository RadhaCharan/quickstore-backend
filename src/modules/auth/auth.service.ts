import {
  Injectable, UnauthorizedException, BadRequestException, Logger, NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { PlatformUser } from './entities/platform-user.entity';
import { Tenant } from '../tenant/tenant.entity';
import { LoginDto } from './dto/login.dto';
import { CustomerOtpDto, VerifyOtpDto } from './dto/otp.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly twilio: Twilio;
  private readonly verifyServiceSid: string;

  constructor(
    @InjectRepository(PlatformUser)
    private readonly userRepo: Repository<PlatformUser>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly jwtService: JwtService,
    private readonly cfg: ConfigService,
  ) {
    this.twilio = new Twilio(
      this.cfg.get<string>('TWILIO_ACCOUNT_SID'),
      this.cfg.get<string>('TWILIO_AUTH_TOKEN'),
    );
    this.verifyServiceSid = this.cfg.get<string>('TWILIO_VERIFY_SID');
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /** Normalise any Indian phone to E.164 (+91XXXXXXXXXX) */
  private toE164(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    return phone.startsWith('+') ? phone : `+${digits}`;
  }

  /** Send OTP via Twilio Verify — shared by all 3 flows */
  private async twilioSend(phone: string): Promise<void> {
    try {
      await this.twilio.verify.v2
        .services(this.verifyServiceSid)
        .verifications.create({ to: phone, channel: 'sms' });
      this.logger.log(`OTP dispatched to ${phone}`);
    } catch (err: any) {
      this.logger.error(`Twilio send failed: ${err.message}`);
      throw new BadRequestException(err.message || 'Failed to send OTP');
    }
  }

  /** Check OTP via Twilio Verify — returns true if approved */
  private async twilioCheck(phone: string, code: string): Promise<boolean> {
    try {
      const result = await this.twilio.verify.v2
        .services(this.verifyServiceSid)
        .verificationChecks.create({ to: phone, code });
      return result.status === 'approved';
    } catch {
      return false;
    }
  }

  // ─── Vendor: email + password login ─────────────────────────────────────────

  async vendorLogin(dto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
      relations: ['tenant'],
    });

    if (!user || !user.passwordHash)
      throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (user.tenant && user.tenant.status !== 'ACTIVE')
      throw new UnauthorizedException('Your store is not yet active. Verify your phone first.');

    return this.issueTokens(user);
  }

  // ─── Vendor: phone OTP login ──────────────────────────────────────────────

  async sendVendorLoginOtp(phone: string) {
    const e164 = this.toE164(phone);
    const tenant = await this.tenantRepo.findOne({ where: { phone: e164 } })
      ?? await this.tenantRepo.findOne({ where: { phone } });

    if (!tenant)
      throw new NotFoundException('No vendor account found for this phone number');
    if (tenant.status !== 'ACTIVE')
      throw new BadRequestException('Your store is not yet active. Complete signup verification first.');

    await this.twilioSend(e164);
    return { message: 'OTP sent to your registered phone' };
  }

  async verifyVendorLoginOtp(phone: string, otp: string) {
    const e164 = this.toE164(phone);
    const approved = await this.twilioCheck(e164, otp);
    if (!approved) throw new BadRequestException('Invalid or expired OTP');

    const tenant = await this.tenantRepo.findOne({ where: { phone: e164 } })
      ?? await this.tenantRepo.findOne({ where: { phone } });
    if (!tenant) throw new NotFoundException('Vendor not found');

    const user = await this.userRepo.findOne({
      where: { tenantId: tenant.id, role: 'VENDOR_OWNER' },
    });
    if (!user) throw new NotFoundException('Vendor user not found');

    return this.issueTokens(user);
  }

  // ─── Vendor: signup phone verification ────────────────────────────────────
  //  Called after signup form submit. Sends OTP to the phone used at signup.

  async sendSignupOtp(phone: string) {
    const e164 = this.toE164(phone);
    const tenant = await this.tenantRepo.findOne({ where: { phone: e164 } })
      ?? await this.tenantRepo.findOne({ where: { phone } });

    if (!tenant) throw new NotFoundException('No account found for this phone. Please sign up first.');

    await this.twilioSend(e164);
    return { message: 'OTP sent. Enter the code to activate your store.' };
  }

  async activateVendorByOtp(phone: string, otp: string) {
    const e164 = this.toE164(phone);
    const approved = await this.twilioCheck(e164, otp);
    if (!approved) throw new BadRequestException('Invalid or expired OTP');

    const tenant = await this.tenantRepo.findOne({ where: { phone: e164 } })
      ?? await this.tenantRepo.findOne({ where: { phone } });
    if (!tenant) throw new NotFoundException('Vendor not found');

    if (tenant.status !== 'ACTIVE') {
      await this.tenantRepo.update(tenant.id, { status: 'ACTIVE' });
    }

    return { message: 'Phone verified! Your store is now active. Please log in.' };
  }

  // ─── Customer: phone OTP login (on vendor storefront) ─────────────────────

  async sendCustomerOtp(dto: CustomerOtpDto) {
    const phone = this.toE164(dto.phone);
    await this.twilioSend(phone);
    return { message: 'OTP sent successfully' };
  }

  async verifyCustomerOtp(dto: VerifyOtpDto, tenantId: string) {
    const phone = this.toE164(dto.phone);
    const approved = await this.twilioCheck(phone, dto.otp);
    if (!approved) throw new BadRequestException('Invalid or expired OTP');

    const payload = { sub: phone, role: 'CUSTOMER', tenantId, type: 'customer' };
    const token = this.jwtService.sign(payload, { expiresIn: '30d' });
    return { accessToken: token, phone };
  }

  // ─── Shared ───────────────────────────────────────────────────────────────

  async createVendorUser(email: string, password: string, tenantId: string, role = 'VENDOR_OWNER') {
    const hash = await bcrypt.hash(password, 12);
    const user = this.userRepo.create({ email, passwordHash: hash, tenantId, role });
    return this.userRepo.save(user);
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
    return { accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId } };
  }
}
