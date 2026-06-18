import { IsString, IsNotEmpty } from 'class-validator';

export class RegisterTunnelDto {
  @IsString()
  @IsNotEmpty({ message: 'Subdomain is required' })
  subdomain: string;
}
