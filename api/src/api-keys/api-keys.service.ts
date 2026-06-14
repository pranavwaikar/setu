import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return keys;
  }

  async generate(userId: string) {
    const plainKey = `se_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');

    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        keyHash,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    return {
      id: apiKey.id,
      key: plainKey,
      createdAt: apiKey.createdAt,
    };
  }

  async revoke(userId: string, id: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id, userId },
    });

    if (!key) {
      throw new NotFoundException('API Key not found.');
    }

    await this.prisma.apiKey.delete({
      where: { id },
    });

    return { success: true };
  }

  async validateKey(plainKey: string) {
    if (!plainKey) return null;
    const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { keyHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            plan: true,
          },
        },
      },
    });
    return apiKey ? apiKey.user : null;
  }
}
