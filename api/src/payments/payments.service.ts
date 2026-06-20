import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DodoPayments } from 'dodopayments';
import { Resend } from 'resend';
import { Plan } from '@prisma/client';


@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async createCheckoutSession(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const dodoApiKey = process.env.DODO_API_KEY || 'dp_test_placeholder_key';
    const isTestMode = process.env.DODO_TEST_MODE !== 'false';
    
    // Check if the API key is a dummy/placeholder key
    const isDummyKey = dodoApiKey === 'dp_test_placeholder_key' || dodoApiKey.includes('placeholder') || dodoApiKey.length < 15;

    const returnTestMode = isTestMode || isDummyKey;

    if (isDummyKey) {
      // Return local mock checkout URL for testing/simulation
      const publicDomain = process.env.PUBLIC_DOMAIN || 'http://localhost:3000';
      return {
        checkoutUrl: `${publicDomain}/payments/mock-checkout?userId=${userId}&email=${encodeURIComponent(user.email)}&testMode=true&plan=PRO`,
        isMock: true,
        isTestMode: true,
      };
    }

    // Call real Dodo Payments API using official TypeScript SDK
    const productId = process.env.DODO_PRO_PRODUCT_ID || 'prod_pro_123';
    const publicDomain = process.env.PUBLIC_DOMAIN || 'http://localhost:3000';

    const client = new DodoPayments({
      bearerToken: dodoApiKey,
      environment: isTestMode ? 'test_mode' : 'live_mode',
    });

    try {
      const session = await client.checkoutSessions.create({
        product_cart: [
          {
            product_id: productId,
            quantity: 1,
          },
        ],
        customer: {
          email: user.email,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Setu Developer',
        },
        return_url: `${publicDomain}/billing?status=success`,
        metadata: {
          userId: user.id,
          plan: 'PRO',
        },
      });

      return {
        checkoutUrl: session.checkout_url,
        isMock: false,
        isTestMode: returnTestMode,
      };
    } catch (err: any) {
      console.error('Failed calling Dodo Payments API:', err);
      // Fail gracefully to mock checkout so developers aren't blocked by network/key issues
      const publicDomain = process.env.PUBLIC_DOMAIN || 'http://localhost:3000';
      return {
        checkoutUrl: `${publicDomain}/payments/mock-checkout?userId=${userId}&email=${encodeURIComponent(user.email)}&testMode=true&plan=PRO`,
        isMock: true,
        isTestMode: true,
      };
    }
  }

  async upgradeUserPlan(
    userId: string,
    plan: 'PRO' | 'ENTERPRISE',
    transactionId: string = 'mock_tx_' + Math.random().toString(36).substring(7),
    amount: number = plan === 'ENTERPRISE' ? 25000 : 500,
    currency: string = 'USD',
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // 1. Update user plan
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        plan: plan as Plan,
      },
    });

    // 2. Log payment in database
    const paymentLog = await (this.prisma as any).paymentLog.create({
      data: {
        userId,
        transactionId,
        amount,
        currency,
        status: 'SUCCESS',
        plan: plan as Plan,
      },
    });

    // 3. Send receipt & upgrade email
    await this.sendPurchaseReceiptEmail(user.email, user.firstName || 'Developer', plan, transactionId, amount, currency);

    return { success: true, logId: paymentLog.id };
  }

  // Handle Dodo webhooks for live/real transactions
  async handleWebhook(
    body: any,
    rawBody: string,
    headers: { webhookId?: string; webhookSignature?: string; webhookTimestamp?: string },
  ) {
    const webhookSecret = process.env.DODO_WEBHOOK_SECRET;

    if (webhookSecret) {
      const dodoApiKey = process.env.DODO_API_KEY || 'dp_test_placeholder_key';
      const client = new DodoPayments({
        bearerToken: dodoApiKey,
        webhookKey: webhookSecret,
      });

      try {
        const event = client.webhooks.unwrap(rawBody, {
          headers: {
            'webhook-id': headers.webhookId || '',
            'webhook-signature': headers.webhookSignature || '',
            'webhook-timestamp': headers.webhookTimestamp || '',
          },
        });
        body = event;
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err);
        throw new BadRequestException('Invalid webhook signature');
      }
    }

    if (body.event_type === 'checkout.completed' && body.data) {
      const data = body.data;
      const userId = data.metadata?.userId;
      const plan = data.metadata?.plan === 'ENTERPRISE' ? 'ENTERPRISE' : 'PRO';
      const transactionId = data.transaction_id || data.id || 'tx_' + Math.random().toString(36).substring(7);
      const amount = data.amount || (plan === 'ENTERPRISE' ? 25000 : 500);
      const currency = data.currency || 'USD';

      if (userId) {
        await this.upgradeUserPlan(userId, plan, transactionId, amount, currency);
      }
    }
    return { received: true };
  }


  private async sendPurchaseReceiptEmail(
    email: string,
    name: string,
    plan: string,
    transactionId: string,
    amount: number,
    currency: string,
  ) {
    const enableEmailVerification = process.env.ENABLE_EMAIL_VERFICATION === 'true';
    if (!enableEmailVerification) {
      console.log(`[Email Skipped] Skipping purchase receipt email to ${email} because ENABLE_EMAIL_VERFICATION is false.`);
      return;
    }

    const resendApiKey = process.env.RESEND_API_KEY || 're_placeholder_key';
    const isPlaceholder = resendApiKey === 're_placeholder_key' || resendApiKey.includes('placeholder');
    
    if (isPlaceholder) {
      console.log(`[Email Mock] Skipping real purchase receipt email to ${email} (Placeholder Resend key).`);
      return;
    }

    const resend = new Resend(resendApiKey);
    const fromAddress = process.env.EMAIL_FROM || 'onboarding@resend.dev';
    const amountFormatted = (amount / 100).toFixed(2);

    try {
      await resend.emails.send({
        from: `Setu Billing <${fromAddress}>`,
        to: email,
        subject: `Payment Receipt: Upgrade to Setu ${plan}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
            <h2 style="color: #7c3aed; margin-bottom: 5px;">Thank you for your purchase!</h2>
            <p style="color: #52525b; font-size: 14px;">Hi ${name},</p>
            <p style="color: #52525b; font-size: 14px; line-height: 1.5;">
              We've successfully processed your payment. Your account has been upgraded to the <strong>Setu ${plan} Plan</strong>.
            </p>
            <div style="background-color: #f4f4f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="margin-top: 0; font-size: 14px; color: #18181b;">Receipt Details</h3>
              <table style="width: 100%; font-size: 13px; color: #52525b; border-collapse: collapse;">
                <tr>
                  <td style="padding: 5px 0;">Plan:</td>
                  <td style="text-align: right; font-weight: bold; color: #18181b;">Setu ${plan}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0;">Transaction ID:</td>
                  <td style="text-align: right; font-family: monospace; color: #18181b;">${transactionId}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0;">Amount Paid:</td>
                  <td style="text-align: right; font-weight: bold; color: #7c3aed;">$${amountFormatted} ${currency}</td>
                </tr>
              </table>
            </div>
            <p style="color: #52525b; font-size: 14px; line-height: 1.5;">
              Your new plan benefits are now active. You can check your upgraded limits inside the developer dashboard.
            </p>
            <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
            <p style="color: #a1a1aa; font-size: 11px; text-align: center;">
              Need help? Reach out at <a href="mailto:sales@contact.helios-logic.com" style="color: #7c3aed; text-decoration: none;">sales@contact.helios-logic.com</a>.
            </p>
          </div>
        `,
      });
      console.log(`[Email Success] Purchase receipt email dispatched to ${email}.`);
    } catch (err) {
      console.error('Failed to send purchase email via Resend:', err);
    }
  }
}
