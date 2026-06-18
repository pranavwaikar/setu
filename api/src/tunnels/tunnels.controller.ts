import { Controller, Get, Post, Body, Headers, UseGuards } from '@nestjs/common';
import { TunnelsService } from './tunnels.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RegisterTunnelDto } from './dto/register-tunnel.dto';
import { GatewayAuthDto } from './dto/gateway-auth.dto';
import { GatewayDisconnectDto } from './dto/gateway-disconnect.dto';

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
  async register(@CurrentUser() user: any, @Body() body: RegisterTunnelDto) {
    return this.tunnelsService.registerTunnel(user.id, body.subdomain);
  }

  // Internal Gateway endpoint: authenticate tunnel connection
  @Post('internal/gateway/auth')
  async authGateway(
    @Headers('x-gateway-secret') gatewaySecret: string,
    @Body() body: GatewayAuthDto,
  ) {
    return this.tunnelsService.authenticateGateway(gatewaySecret, body.apiKey, body.subdomain, body.localPort);
  }

  // Internal Gateway endpoint: register tunnel disconnect
  @Post('internal/gateway/disconnect')
  async disconnectGateway(
    @Headers('x-gateway-secret') gatewaySecret: string,
    @Body() body: GatewayDisconnectDto,
  ) {
    return this.tunnelsService.disconnectGateway(gatewaySecret, body.tunnelId);
  }
}
