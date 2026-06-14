import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const RESERVED_WORDS = new Set([
  'admin', 'api', 'root', 'support', 'www', 'mail', 'dns', 'gateway', 'dashboard', 'helios', 'setu', 'auth', 'status', 'docs'
]);

@Injectable()
export class SubdomainsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.subdomain.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async claim(userId: string, hostname: string) {
    // 1. Format validation
    const cleanHostname = hostname.trim().toLowerCase();
    const hostnameRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
    if (!hostnameRegex.test(cleanHostname)) {
      throw new BadRequestException(
        'Subdomain must contain only lowercase letters, numbers, or hyphens, and be between 1 and 63 characters long.',
      );
    }

    if (cleanHostname.length < 3) {
      throw new BadRequestException('Subdomain must be at least 3 characters long.');
    }

    // 2. Reserved words check
    if (RESERVED_WORDS.has(cleanHostname)) {
      throw new BadRequestException('This subdomain name is reserved.');
    }

    // 3. User quota check (Max 10 subdomains)
    const count = await this.prisma.subdomain.count({
      where: { userId },
    });
    if (count >= 10) {
      throw new BadRequestException('You have reached your limit of 10 subdomains.');
    }

    // 4. Check uniqueness
    const existing = await this.prisma.subdomain.findUnique({
      where: { hostname: cleanHostname },
    });
    if (existing) {
      throw new ConflictException('Subdomain is already claimed.');
    }

    // 5. Create Subdomain
    return this.prisma.subdomain.create({
      data: {
        userId,
        hostname: cleanHostname,
        status: 'ACTIVE',
      },
    });
  }

  async release(userId: string, id: string) {
    const subdomain = await this.prisma.subdomain.findFirst({
      where: { id, userId },
    });

    if (!subdomain) {
      throw new NotFoundException('Subdomain not found.');
    }

    await this.prisma.subdomain.delete({
      where: { id },
    });

    return { success: true };
  }
}
