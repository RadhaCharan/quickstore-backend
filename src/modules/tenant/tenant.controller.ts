import {
  Controller, Post, Get, Patch, Param, Body, UseGuards, Request,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiBody,
} from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';

class ApproveDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  featureKeys?: string[];
}
class RejectDto {
  @IsString()
  @IsNotEmpty()
  notes: string;
}
class UpdateTenantDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() ownerName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() category?: string;
}

@ApiTags('Tenant')
@Controller()
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  // ─── Public ───────────────────────────────────────────────────────────────────

  @Public()
  @Post('tenant/signup')
  @ApiOperation({ summary: 'Vendor self-signup — creates tenant in PENDING state' })
  signup(@Body() dto: CreateTenantDto) {
    return this.tenantService.signup(dto);
  }

  // ─── Vendor (own tenant) ─────────────────────────────────────────────────────

  @UseGuards(JwtGuard)
  @Get('tenant/me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get own tenant config + feature flags' })
  getMe(@Request() req: any) {
    return this.tenantService.getMyConfig(req.user.tenantId);
  }

  @UseGuards(JwtGuard)
  @Patch('tenant/me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own tenant profile' })
  updateMe(@Request() req: any, @Body() dto: UpdateTenantDto) {
    return this.tenantService.updateMyConfig(req.user.tenantId, dto);
  }

  @UseGuards(JwtGuard)
  @Get('tenant/features')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get feature flags for own tenant' })
  getFeatures(@Request() req: any) {
    return this.tenantService.getTenantFeatures(req.user.tenantId);
  }

  // ─── Super Admin ─────────────────────────────────────────────────────────────

  @UseGuards(JwtGuard)
  @Get('admin/onboarding-requests')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[SUPER_ADMIN] List all onboarding requests' })
  getOnboardingRequests() {
    return this.tenantService.getAllOnboardingRequests();
  }

  @UseGuards(JwtGuard)
  @Patch('admin/onboarding-requests/:id/approve')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Tenant ID to approve' })
  @ApiOperation({ summary: '[SUPER_ADMIN] Approve a tenant onboarding request' })
  approveTenant(@Param('id') id: string, @Body() dto: ApproveDto, @Request() req: any) {
    return this.tenantService.approveTenant(id, dto.featureKeys ?? [], req.user?.email);
  }

  @UseGuards(JwtGuard)
  @Patch('admin/onboarding-requests/:id/reject')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Tenant ID to reject' })
  @ApiOperation({ summary: '[SUPER_ADMIN] Reject a tenant onboarding request' })
  rejectTenant(@Param('id') id: string, @Body() dto: RejectDto, @Request() req: any) {
    return this.tenantService.rejectTenant(id, dto.notes, req.user?.email);
  }

  @UseGuards(JwtGuard)
  @Get('admin/tenants')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[SUPER_ADMIN] List all tenants' })
  getAllTenants() {
    return this.tenantService.getAllTenants();
  }
}
