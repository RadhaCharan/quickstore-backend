import {
  Injectable, BadRequestException, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Razorpay = require('razorpay');

@Injectable()
export class PaymentService {
  private razorpay: any;

  constructor(
    private readonly cfg: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.razorpay = new Razorpay({
      key_id: this.cfg.get<string>('RAZORPAY_KEY_ID', ''),
      key_secret: this.cfg.get<string>('RAZORPAY_KEY_SECRET', ''),
    });
  }

  /**
   * Create a Razorpay order. Call this before showing the payment UI.
   * Amount is in rupees; we convert to paise for Razorpay.
   */
  async createRazorpayOrder(schemaName: string, orderId: string, amount: number) {
    const s = `"${schemaName}"`;

    // Fetch the internal order to validate it exists
    const [internalOrder] = await this.dataSource.query(
      `SELECT id, order_number, total FROM ${s}.orders WHERE id = $1`,
      [orderId],
    );
    if (!internalOrder) throw new BadRequestException(`Order ${orderId} not found`);

    const amountPaise = Math.round((amount ?? internalOrder.total) * 100);

    const rzpOrder = await this.razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: internalOrder.order_number,
      notes: { internalOrderId: orderId },
    });

    return {
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      receipt: rzpOrder.receipt,
    };
  }

  /**
   * Verify Razorpay payment signature after client-side checkout completes.
   * On success, marks the order as PAID.
   */
  async verifyPayment(
    schemaName: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    signature: string,
    internalOrderId: string,
  ) {
    const keySecret = this.cfg.get<string>('RAZORPAY_KEY_SECRET', '');
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new UnauthorizedException('Payment signature verification failed');
    }

    const s = `"${schemaName}"`;
    await this.dataSource.query(
      `UPDATE ${s}.orders
       SET payment_status = 'PAID', status = 'CONFIRMED', updated_at = NOW()
       WHERE id = $1`,
      [internalOrderId],
    );

    return { success: true, message: 'Payment verified and order confirmed', razorpayPaymentId };
  }

  /**
   * Handle Razorpay webhook events (e.g., payment.captured, order.paid, payment.failed).
   * Signature is verified using the webhook secret.
   */
  async handleWebhook(payload: any, signature: string) {
    const webhookSecret = this.cfg.get<string>('RAZORPAY_WEBHOOK_SECRET', '');
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (expectedSig !== signature) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const event = payload.event as string;

    if (event === 'payment.captured' || event === 'order.paid') {
      const entity = payload.payload?.payment?.entity ?? payload.payload?.order?.entity;
      const internalOrderId = entity?.notes?.internalOrderId;
      const tenantSchemaName = entity?.notes?.tenantSchemaName;

      if (internalOrderId && tenantSchemaName) {
        const s = `"${tenantSchemaName}"`;
        await this.dataSource.query(
          `UPDATE ${s}.orders
           SET payment_status = 'PAID', status = 'CONFIRMED', updated_at = NOW()
           WHERE id = $1 AND payment_status != 'PAID'`,
          [internalOrderId],
        );
      }
    } else if (event === 'payment.failed') {
      const entity = payload.payload?.payment?.entity;
      const internalOrderId = entity?.notes?.internalOrderId;
      const tenantSchemaName = entity?.notes?.tenantSchemaName;

      if (internalOrderId && tenantSchemaName) {
        const s = `"${tenantSchemaName}"`;
        await this.dataSource.query(
          `UPDATE ${s}.orders
           SET payment_status = 'FAILED', updated_at = NOW()
           WHERE id = $1`,
          [internalOrderId],
        );
      }
    }

    return { received: true, event };
  }
}
