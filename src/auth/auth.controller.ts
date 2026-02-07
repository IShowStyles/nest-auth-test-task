import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AccessGuard } from './guards/at.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.auth.register(dto);
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      createdAt: user.createdAt,
    };
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const token = await this.auth.login(dto);
    return token;
  }

  @UseGuards(AccessGuard)
  @Get('me')
  async me(@Req() req: any) {
    console.log(req.user.sub);
    return this.auth.me(req.user.sub);
  }
}
