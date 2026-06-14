import { Module } from '@nestjs/common';
import { SubdomainsService } from './subdomains.service';
import { SubdomainsController } from './subdomains.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [SubdomainsService],
  controllers: [SubdomainsController],
  exports: [SubdomainsService],
})
export class SubdomainsModule {}
