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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, plan: true },
    });

    const cleanFirst = (user?.firstName || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const cleanLast = (user?.lastName || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const nameSuffix = [cleanFirst, cleanLast].filter(Boolean).join('-');
    const suffix = nameSuffix ? `-${nameSuffix}` : '';

    let cleanHostname = hostname.trim().toLowerCase();
    if (suffix && !cleanHostname.endsWith(suffix)) {
      cleanHostname = `${cleanHostname}${suffix}`;
    }

    // 1. Format validation
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

    // 3. User quota check
    const count = await this.prisma.subdomain.count({
      where: { userId },
    });
    const userPlan = user?.plan as string;
    const maxSubdomains = userPlan === 'PRO' ? 50 : userPlan === 'ENTERPRISE' ? 1000 : 10;

    if (count >= maxSubdomains) {
      throw new BadRequestException(`You have reached your limit of ${maxSubdomains} subdomains.`);
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
