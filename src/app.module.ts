import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { ProductModule } from './modules/product/product.module';
import { CategoryModule } from './modules/category/category.module';
import { OrderModule } from './modules/order/order.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { PaymentModule } from './modules/payment/payment.module';
import { DiscountModule } from './modules/discount/discount.module';
import { CustomerModule } from './modules/customer/customer.module';
import { StorefrontModule } from './modules/storefront/storefront.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get('DB_HOST', 'localhost'),
        port: cfg.get<number>('DB_PORT', 5432),
        username: cfg.get('DB_USER', 'quickstore'),
        password: cfg.get('DB_PASSWORD', 'quickstore123'),
        database: cfg.get('DB_NAME', 'quickstore_platform'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
        logging: cfg.get('NODE_ENV') === 'development',
      }),
    }),

    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (cfg: ConfigService) => {
        const redisPassword = cfg.get('REDIS_PASSWORD');
        return {
          store: await redisStore({
            socket: {
              host: cfg.get('REDIS_HOST', 'localhost'),
              port: cfg.get<number>('REDIS_PORT', 6379),
            },
            ...(redisPassword ? { password: redisPassword } : {}),
            ttl: 300,
          }),
        };
      },
    }),

    AuthModule,
    TenantModule,
    ProductModule,
    CategoryModule,
    OrderModule,
    DeliveryModule,
    PaymentModule,
    DiscountModule,
    CustomerModule,
    StorefrontModule,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'v1/storefront/:slug', method: RequestMethod.GET },
        { path: 'v1/storefront/:slug/products', method: RequestMethod.GET },
        { path: 'v1/storefront/:slug/categories', method: RequestMethod.GET },
        { path: 'v1/auth/(.*)', method: RequestMethod.POST },
        { path: 'v1/tenant/signup', method: RequestMethod.POST },
        { path: 'v1/payments/webhook', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}
