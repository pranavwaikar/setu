import { IsString, IsNotEmpty } from 'class-validator';

export class GatewayDisconnectDto {
  @IsString()
  @IsNotEmpty()
  tunnelId: string;
}
