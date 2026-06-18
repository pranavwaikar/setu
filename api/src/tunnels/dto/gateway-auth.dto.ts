import { IsString, IsNotEmpty, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GatewayAuthDto {
  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @IsString()
  @IsNotEmpty()
  subdomain: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  localPort: number;
}
