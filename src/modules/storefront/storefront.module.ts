import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { FeatureFlag } from '../tenant/entities/feature-flag.entity';
import { StorefrontService } from './storefront.service';
import { StorefrontController } from './storefront.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, FeatureFlag])],
  providers: [StorefrontService],
  controllers: [StorefrontController],
  exports: [StorefrontService],
})
export class StorefrontModule {}
