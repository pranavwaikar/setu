import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. Try API Key authentication
    const apiKey = request.headers['x-api-key'] || request.headers['X-API-Key'];
    if (apiKey && typeof apiKey === 'string') {
      const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
      const keyRecord = await this.prisma.apiKey.findFirst({
        where: { keyHash },
        include: {
          user: {
            select: { id: true, email: true, plan: true, createdAt: true, firstName: true, lastName: true },
          },
        },
      });

      if (!keyRecord || !keyRecord.user) {
        throw new UnauthorizedException('Invalid API Key');
      }

      request.user = keyRecord.user;
      return true;
    }

    // 2. Fallback to JWT Cookie/Bearer token authentication
    const token = this.extractTokenFromRequest(request);

    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'supersecretjwtkey',
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, plan: true, createdAt: true, firstName: true, lastName: true },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      request.user = user;
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return true;
  }

  private extractTokenFromRequest(request: Request): string | undefined {
    // 1. Try extracting from cookie
    if (request.cookies && request.cookies.token) {
      return request.cookies.token;
    }
    // 2. Try extracting from Authorization header
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
