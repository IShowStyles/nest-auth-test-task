import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username must be alphanumeric/underscore',
  })
  username!: string;
  @IsString() @MinLength(2) @MaxLength(80) fullName!: string;
  @IsString() @MinLength(8) @MaxLength(72) password!: string;
}
