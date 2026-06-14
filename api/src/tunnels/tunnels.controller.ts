import { Controller, Get, Post, Body, Headers, UseGuards } from '@nestjs/common';
import { TunnelsService } from './tunnels.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller()
export class TunnelsController {
  constructor(private tunnelsService: TunnelsService) {}

  // User endpoint: list active/inactive tunnels
  @Get('tunnels')
  @UseGuards(AuthGuard)
  async list(@CurrentUser() user: any) {
    return this.tunnelsService.list(user.id);
  }

  // User endpoint: register a tunnel subdomain and get its public URL
  @Post('tunnels')
  @UseGuards(AuthGuard)
  async register(@CurrentUser() user: any, @Body('subdomain') subdomain: string) {
    return this.tunnelsService.registerTunnel(user.id, subdomain);
  }

  // Internal Gateway endpoint: authenticate tunnel connection
  @Post('internal/gateway/auth')
  async authGateway(
    @Headers('x-gateway-secret') gatewaySecret: string,
    @Body('apiKey') apiKey: string,
    @Body('subdomain') subdomain: string,
    @Body('localPort') localPort: number,
  ) {
    return this.tunnelsService.authenticateGateway(gatewaySecret, apiKey, subdomain, localPort);
  }

  // Internal Gateway endpoint: register tunnel disconnect
  @Post('internal/gateway/disconnect')
  async disconnectGateway(
    @Headers('x-gateway-secret') gatewaySecret: string,
    @Body('tunnelId') tunnelId: string,
  ) {
    return this.tunnelsService.disconnectGateway(gatewaySecret, tunnelId);
  }
}
