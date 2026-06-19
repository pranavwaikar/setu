import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SubdomainsModule } from './subdomains/subdomains.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { TunnelsModule } from './tunnels/tunnels.module';
import { AdminPanelModule } from './admin/admin.module';

@Module({
  imports: [PrismaModule, AuthModule, SubdomainsModule, ApiKeysModule, TunnelsModule, AdminPanelModule.register()],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}





