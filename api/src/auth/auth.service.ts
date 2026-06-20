import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Resend } from 'resend';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthService {
  private resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder_key');

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(email: string, password: string, firstName?: string, lastName?: string) {
    if (!password || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const enableVerification = process.env.ENABLE_EMAIL_VERFICATION === 'true';
    const verificationToken = enableVerification ? randomUUID() : null;
    const isVerified = !enableVerification;

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        isVerified,
        verificationToken,
      },
      select: {
        id: true,
        email: true,
        plan: true,
        createdAt: true,
        firstName: true,
        lastName: true,
        isVerified: true,
        subscriptionId: true,
        subscriptionStatus: true,
      },
    });

    if (enableVerification && verificationToken) {
      const verifyLink = `${process.env.PUBLIC_DOMAIN || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
      const fromAddress = process.env.EMAIL_FROM || 'onboarding@resend.dev';
      try {
        await this.resend.emails.send({
          from: fromAddress,
          to: [email],
          subject: 'Verify your email address - Setu',
          html: `<p>Welcome to Setu, ${firstName || 'User'}!</p><p>Please verify your email address by clicking <a href="${verifyLink}">here</a>.</p>`,
        });
      } catch (err) {
        console.error('Resend error sending verification email:', err);
        throw new BadRequestException('Failed to send verification email. Please verify your RESEND_API_KEY configuration.');
      }
    }

    return user;
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const enableVerification = process.env.ENABLE_EMAIL_VERFICATION === 'true';
    if (enableVerification && !user.isVerified) {
      throw new UnauthorizedException('Please verify your email address before logging in.');
    }

    const payload = { sub: user.id, email: user.email };
    const token = await this.jwtService.signAsync(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        plan: user.plan,
        createdAt: user.createdAt,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified,
        subscriptionId: user.subscriptionId,
        subscriptionStatus: user.subscriptionStatus,
      },
      token,
    };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
      },
    });

    return { success: true };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Prevents user enumeration
      return { success: true };
    }

    const resetToken = randomUUID();
    const resetTokenExpires = new Date(Date.now() + 3600 * 1000); // 1 hour expiry

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpires,
      },
    });

    const resetLink = `${process.env.PUBLIC_DOMAIN || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    const fromAddress = process.env.EMAIL_FROM || 'onboarding@resend.dev';

    try {
      await this.resend.emails.send({
        from: fromAddress,
        to: [email],
        subject: 'Reset your password - Setu',
        html: `<p>You requested to reset your password. Click <a href="${resetLink}">here</a> to choose a new password.</p><p>This link will expire in 1 hour.</p>`,
      });
    } catch (err) {
      console.error('Resend error sending forgot password email:', err);
      throw new BadRequestException('Failed to send password reset email.');
    }

    return { success: true };
  }

  async resetPassword(token: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpires: null,
      },
    });
    return { success: true };
  }
}
// Trigger TS language server reload with new Prisma typings
