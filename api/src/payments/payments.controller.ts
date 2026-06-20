import { Controller, Post, Body, Headers, UseGuards, Req } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Request } from 'express';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('checkout')
  @UseGuards(AuthGuard)
  async createCheckoutSession(@CurrentUser() user: any) {
    return this.paymentsService.createCheckoutSession(user.id);
  }

  @Post('mock-success')
  @UseGuards(AuthGuard)
  async mockSuccess(@CurrentUser() user: any, @Body() body: { plan?: string }) {
    const plan = body.plan === 'ENTERPRISE' ? 'ENTERPRISE' : 'PRO';
    const amount = plan === 'ENTERPRISE' ? 25000 : 500;
    return this.paymentsService.upgradeUserPlan(
      user.id,
      plan,
      'mock_tx_' + Math.random().toString(36).substring(7),
      amount,
      'USD'
    );
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('webhook-id') webhookId: string,
    @Headers('webhook-signature') webhookSignature: string,
    @Headers('webhook-timestamp') webhookTimestamp: string,
    @Headers('x-dodo-signature') xDodoSignature: string,
    @Body() body: any,
  ) {
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(body);
    return this.paymentsService.handleWebhook(
      body,
      rawBody,
      {
        webhookId,
        webhookSignature: webhookSignature || xDodoSignature,
        webhookTimestamp,
      }
    );
  }
}

