import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './tenant.entity';
import { FeatureFlag } from './entities/feature-flag.entity';
import { OnboardingRequest } from './entities/onboarding-request.entity';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, FeatureFlag, OnboardingRequest]),
    forwardRef(() => AuthModule),
  ],
  providers: [TenantService],
  controllers: [TenantController],
  exports: [TenantService],
})
export class TenantModule {}
