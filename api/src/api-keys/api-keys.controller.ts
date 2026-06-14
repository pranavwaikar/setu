import { Controller, Get, Post, Delete, Param, UseGuards } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('api-keys')
@UseGuards(AuthGuard)
export class ApiKeysController {
  constructor(private apiKeysService: ApiKeysService) {}

  @Get()
  async list(@CurrentUser() user: any) {
    return this.apiKeysService.list(user.id);
  }

  @Post()
  async generate(@CurrentUser() user: any) {
    return this.apiKeysService.generate(user.id);
  }

  @Delete(':id')
  async revoke(@CurrentUser() user: any, @Param('id') id: string) {
    return this.apiKeysService.revoke(user.id, id);
  }
}
