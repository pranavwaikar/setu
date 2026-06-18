import { IsString, IsNotEmpty, IsInt, Min, Max } from 'class-validator';

export class GatewayAuthDto {
  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @IsString()
  @IsNotEmpty()
  subdomain: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  localPort: number;
}
