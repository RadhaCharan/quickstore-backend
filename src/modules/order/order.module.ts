import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { CustomerModule } from '../customer/customer.module';
import { DiscountModule } from '../discount/discount.module';

@Module({
  imports: [CustomerModule, DiscountModule],
  providers: [OrderService],
  controllers: [OrderController],
  exports: [OrderService],
})
export class OrderModule {}
