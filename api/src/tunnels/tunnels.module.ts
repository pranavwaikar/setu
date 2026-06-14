import { Module } from '@nestjs/common';
import { TunnelsService } from './tunnels.service';
import { TunnelsController } from './tunnels.controller';
import { AuthModule } from '../auth/auth.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
  imports: [AuthModule, ApiKeysModule],
  providers: [TunnelsService],
  controllers: [TunnelsController],
  exports: [TunnelsService],
})
export class TunnelsModule {}
