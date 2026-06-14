import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { SubdomainsService } from '../subdomains/subdomains.service';

@Injectable()
export class TunnelsService {
  constructor(
    private prisma: PrismaService,
    private apiKeysService: ApiKeysService,
    private subdomainsService: SubdomainsService,
  ) {}

  async list(userId: string) {
    return this.prisma.tunnel.findMany({
      where: { userId },
      include: {
        subdomain: {
          select: { hostname: true },
        },
      },
      orderBy: { connectedAt: 'desc' },
    });
  }

  async authenticateGateway(gatewaySecret: string, apiKey: string, hostname: string, localPort: number) {
    // 1. Verify Gateway Secret
    const expectedSecret = process.env.GATEWAY_API_TOKEN || 'default-gateway-secret';
    if (gatewaySecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid gateway secret');
    }

    // 2. Validate user API Key
    const user = await this.apiKeysService.validateKey(apiKey);
    if (!user) {
      throw new UnauthorizedException('Invalid user API Key');
    }

    // 3. Find and validate Subdomain
    const subdomain = await this.prisma.subdomain.findFirst({
      where: { hostname: hostname.trim().toLowerCase(), userId: user.id },
    });

    if (!subdomain) {
      throw new BadRequestException('Subdomain not claimed or doesn\'t belong to this user');
    }

    if (subdomain.status !== 'ACTIVE') {
      throw new BadRequestException('Subdomain is not active');
    }

    // 4. Register active tunnel or update existing
    let tunnel = await this.prisma.tunnel.findFirst({
      where: { subdomainId: subdomain.id },
    });

    if (tunnel) {
      tunnel = await this.prisma.tunnel.update({
        where: { id: tunnel.id },
        data: {
          status: 'ONLINE',
          localPort,
          connectedAt: new Date(),
        },
      });
    } else {
      tunnel = await this.prisma.tunnel.create({
        data: {
          userId: user.id,
          subdomainId: subdomain.id,
          localPort,
          status: 'ONLINE',
          connectedAt: new Date(),
        },
      });
    }

    return {
      success: true,
      tunnelId: tunnel.id,
      userId: user.id,
      email: user.email,
      hostname: subdomain.hostname,
    };
  }

  async disconnectGateway(gatewaySecret: string, tunnelId: string) {
    // 1. Verify Gateway Secret
    const expectedSecret = process.env.GATEWAY_API_TOKEN || 'default-gateway-secret';
    if (gatewaySecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid gateway secret');
    }

    // 2. Mark tunnel offline
    const tunnel = await this.prisma.tunnel.findUnique({
      where: { id: tunnelId },
    });

    if (!tunnel) {
      throw new NotFoundException('Tunnel not found');
    }

    await this.prisma.tunnel.update({
      where: { id: tunnelId },
      data: {
        status: 'OFFLINE',
      },
    });

    return { success: true };
  }

  async registerTunnel(userId: string, subdomainName: string) {
    if (!subdomainName) {
      throw new BadRequestException('Subdomain name is required');
    }

    const cleanSubdomain = subdomainName.trim().toLowerCase();

    // 1. Check if subdomain is already claimed
    let subdomain = await this.prisma.subdomain.findUnique({
      where: { hostname: cleanSubdomain },
    });

    if (!subdomain) {
      // If not claimed at all, claim it for this user
      subdomain = await this.subdomainsService.claim(userId, cleanSubdomain);
    } else if (subdomain.userId !== userId) {
      // If claimed by someone else, throw error
      throw new BadRequestException('Subdomain is already claimed by another user');
    }

    const domainSuffix = process.env.PUBLIC_DOMAIN || 'https://setu.helios-logic.com';
    let cleanDomain = domainSuffix.replace(/^https?:\/\//, '');
    const scheme = domainSuffix.startsWith('http://') ? 'http' : 'https';

    return {
      publicUrl: `${scheme}://${cleanSubdomain}.${cleanDomain}`,
    };
  }
}
