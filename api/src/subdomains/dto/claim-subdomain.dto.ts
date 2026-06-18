import { IsString, Matches, MinLength, MaxLength } from 'class-validator';

export class ClaimSubdomainDto {
  @IsString()
  @MinLength(3, { message: 'Subdomain must be at least 3 characters long' })
  @MaxLength(63, { message: 'Subdomain must be at most 63 characters long' })
  @Matches(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/, {
    message: 'Subdomain must contain only lowercase letters, numbers, or hyphens.',
  })
  hostname: string;
}
