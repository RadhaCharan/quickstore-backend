import {
  Controller, Post, Body, Headers, UseGuards, RawBodyRequest, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';

class CreateRazorpayOrderDto {
  orderId: string;
  amount: number;
}

class VerifyPaymentDto {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
  internalOrderId: string;
}

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @UseGuards(JwtGuard)
  @Post('create-order')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a Razorpay order to initiate payment' })
  createRazorpayOrder(
    @CurrentTenant('schema') schemaName: string,
    @Body() dto: CreateRazorpayOrderDto,
  ) {
    return this.paymentService.createRazorpayOrder(schemaName, dto.orderId, dto.amount);
  }

  @UseGuards(JwtGuard)
  @Post('verify')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify Razorpay payment signature after checkout' })
  verifyPayment(
    @CurrentTenant('schema') schemaName: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.paymentService.verifyPayment(
      schemaName,
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.signature,
      dto.internalOrderId,
    );
  }

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: '[PUBLIC] Razorpay webhook endpoint — do not call directly' })
  handleWebhook(
    @Body() payload: any,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    return this.paymentService.handleWebhook(payload, signature);
  }
}
