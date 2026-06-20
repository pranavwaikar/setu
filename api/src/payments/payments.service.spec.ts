import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

// Mock Resend dependency
const mockSend = jest.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null });
jest.mock('resend', () => {
  return {
    Resend: jest.fn().mockImplementation(() => {
      return {
        emails: {
          send: mockSend,
        },
      };
    }),
  };
});

// Mock DodoPayments dependency
const mockUnwrap = jest.fn();
jest.mock('dodopayments', () => {
  return {
    DodoPayments: jest.fn().mockImplementation(() => {
      return {
        webhooks: {
          unwrap: mockUnwrap,
        },
      };
    }),
  };
});

describe('PaymentsService - Email & Webhook verification tests', () => {
  let service: PaymentsService;
  let prismaService: PrismaService;
  let originalEnv: NodeJS.ProcessEnv;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'Alice',
    lastName: 'Smith',
    plan: 'FREE',
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn().mockResolvedValue(mockUser),
      update: jest.fn().mockResolvedValue({ ...mockUser, plan: 'PRO' }),
      findFirst: jest.fn().mockResolvedValue(mockUser),
    },
    paymentLog: {
      create: jest.fn().mockResolvedValue({ id: 'log-123' }),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    originalEnv = { ...process.env };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('upgradeUserPlan', () => {
    it('should upgrade the user plan and send an email if a non-placeholder RESEND_API_KEY is configured (even if ENABLE_EMAIL_VERFICATION is false)', async () => {
      process.env.ENABLE_EMAIL_VERFICATION = 'false';
      process.env.RESEND_API_KEY = 're_real_api_key_123';

      const result = await service.upgradeUserPlan('user-123', 'PRO', 'tx_123', 500, 'USD');

      expect(result.success).toBe(true);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          plan: 'PRO',
          subscriptionId: null,
          subscriptionStatus: 'active',
        },
      });
      expect(mockPrismaService.paymentLog.create).toHaveBeenCalled();
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        to: 'test@example.com',
        subject: expect.stringContaining('PRO'),
      }));
    });

    it('should upgrade the user plan and skip email sending if RESEND_API_KEY is placeholder', async () => {
      process.env.RESEND_API_KEY = 're_placeholder_key';

      const result = await service.upgradeUserPlan('user-123', 'PRO', 'tx_123', 500, 'USD');

      expect(result.success).toBe(true);
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('downgradeUserPlan', () => {
    it('should downgrade the user plan to FREE and log it in the audit log', async () => {
      const result = await service.downgradeUserPlan('user-123', 'failed', 'tx_failed_123', 'Insolvent account');

      expect(result.success).toBe(true);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          plan: 'FREE',
          subscriptionStatus: 'failed',
        },
      });
      expect(mockPrismaService.paymentLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-123',
          transactionId: 'tx_failed_123',
          status: 'FAILED',
          plan: 'FREE',
          errorMessage: 'Insolvent account',
        })
      }));
    });
  });

  describe('cancelSubscription', () => {
    it('should simulate cancellation when API key is a placeholder', async () => {
      process.env.DODO_API_KEY = 'dp_test_placeholder_key';
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce({
        ...mockUser,
        subscriptionId: 'sub_active_123',
      });
      const result = await service.cancelSubscription('user-123');
      expect(result.success).toBe(true);
      expect(result.isMock).toBe(true);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          plan: 'FREE',
          subscriptionStatus: 'cancelled',
        }),
      }));
    });
  });

  describe('handleWebhook', () => {
    const checkoutCompletedPayload = {
      event_type: 'checkout.completed',
      data: {
        transaction_id: 'tx_dodo_123',
        amount: 500,
        currency: 'USD',
        metadata: {
          userId: 'user-123',
          plan: 'PRO',
        },
      },
    };

    const subscriptionActivePayload = {
      type: 'subscription.active',
      data: {
        subscription_id: 'sub_dodo_123',
        recurring_pre_tax_amount: 500,
        currency: 'USD',
        metadata: {
          userId: 'user-123',
          plan: 'PRO',
        },
      },
    };

    const paymentSucceededPayload = {
      type: 'payment.succeeded',
      data: {
        payment_id: 'pay_dodo_123',
        total_amount: 500,
        currency: 'USD',
        metadata: {
          userId: 'user-123',
          plan: 'PRO',
        },
      },
    };

    it('should process checkout.completed webhook directly without verification if DODO_WEBHOOK_SECRET is not set', async () => {
      delete process.env.DODO_WEBHOOK_SECRET;

      const result = await service.handleWebhook(checkoutCompletedPayload, JSON.stringify(checkoutCompletedPayload), {});

      expect(result).toEqual({ received: true });
      expect(mockUnwrap).not.toHaveBeenCalled();
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });

    it('should process subscription.active webhook directly without verification if DODO_WEBHOOK_SECRET is not set', async () => {
      delete process.env.DODO_WEBHOOK_SECRET;

      const result = await service.handleWebhook(subscriptionActivePayload, JSON.stringify(subscriptionActivePayload), {});

      expect(result).toEqual({ received: true });
      expect(mockUnwrap).not.toHaveBeenCalled();
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });

    it('should process payment.succeeded webhook directly without verification if DODO_WEBHOOK_SECRET is not set', async () => {
      delete process.env.DODO_WEBHOOK_SECRET;

      const result = await service.handleWebhook(paymentSucceededPayload, JSON.stringify(paymentSucceededPayload), {});

      expect(result).toEqual({ received: true });
      expect(mockUnwrap).not.toHaveBeenCalled();
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });

    it('should call unwrap and process webhook if DODO_WEBHOOK_SECRET is set and verification succeeds', async () => {
      process.env.DODO_WEBHOOK_SECRET = 'whsec_secret_123';
      mockUnwrap.mockReturnValue(checkoutCompletedPayload);

      const result = await service.handleWebhook(
        { some: 'dummy_parsed_body' },
        'raw_body_string',
        {
          webhookId: 'web_id_123',
          webhookSignature: 'sig_123',
          webhookTimestamp: 'time_123',
        },
      );

      expect(result).toEqual({ received: true });
      expect(mockUnwrap).toHaveBeenCalledWith('raw_body_string', {
        headers: {
          'webhook-id': 'web_id_123',
          'webhook-signature': 'sig_123',
          'webhook-timestamp': 'time_123',
        },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException and NOT process webhook if DODO_WEBHOOK_SECRET is set but verification fails', async () => {
      process.env.DODO_WEBHOOK_SECRET = 'whsec_secret_123';
      mockUnwrap.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(
        service.handleWebhook(
          { some: 'dummy_parsed_body' },
          'raw_body_string',
          {
            webhookId: 'web_id_123',
            webhookSignature: 'sig_123',
            webhookTimestamp: 'time_123',
          },
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('should process subscription.cancelled webhook and downgrade user to FREE', async () => {
      delete process.env.DODO_WEBHOOK_SECRET;

      const payload = {
        type: 'subscription.cancelled',
        data: {
          subscription_id: 'sub_dodo_123',
          customer: {
            email: 'test@example.com',
          },
          cancellation_comment: 'User cancelled',
        },
      };

      const result = await service.handleWebhook(payload, JSON.stringify(payload), {});

      expect(result).toEqual({ received: true });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          plan: 'FREE',
          subscriptionStatus: 'cancelled',
        }),
      }));
    });
  });
});
