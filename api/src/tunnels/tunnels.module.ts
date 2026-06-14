import { Module } from '@nestjs/common';
import { TunnelsService } from './tunnels.service';
import { TunnelsController } from './tunnels.controller';
import { AuthModule } from '../auth/auth.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { SubdomainsModule } from '../subdomains/subdomains.module';

@Module({
  imports: [AuthModule, ApiKeysModule, SubdomainsModule],
  providers: [TunnelsService],
  controllers: [TunnelsController],
  exports: [TunnelsService],
})
export class TunnelsModule {}
