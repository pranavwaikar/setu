import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SubdomainsService } from './subdomains.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('subdomains')
@UseGuards(AuthGuard)
export class SubdomainsController {
  constructor(private subdomainsService: SubdomainsService) {}

  @Get()
  async list(@CurrentUser() user: any) {
    return this.subdomainsService.list(user.id);
  }

  @Post()
  async claim(@CurrentUser() user: any, @Body('hostname') hostname: string) {
    return this.subdomainsService.claim(user.id, hostname);
  }

  @Delete(':id')
  async release(@CurrentUser() user: any, @Param('id') id: string) {
    return this.subdomainsService.release(user.id, id);
  }
}
