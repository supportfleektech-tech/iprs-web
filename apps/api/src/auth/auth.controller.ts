import { Body, Controller, Get, HttpCode, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { AuthService, LoginBody } from './auth.service';
import { JwtAuthGuard, type JwtPayload } from './jwt-auth.guard';
import { CurrentUser } from './auth.decorators';
import { RolesGuard } from './roles.guard';

export class RegisterBody {
  @IsEmail()
  email!: string;

  @IsString() @MinLength(8)
  password!: string;

  @IsString() @IsNotEmpty()
  firstName!: string;

  @IsString() @IsNotEmpty()
  lastName!: string;

  @IsString() @IsNotEmpty()
  organizationName!: string;
}

export class RefreshDto {
  @IsString() @IsNotEmpty()
  refreshToken!: string;
}

export class LogoutDto {
  @IsString() @IsNotEmpty()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString() @IsNotEmpty()
  token!: string;

  @IsString() @MinLength(8)
  newPassword!: string;
}

@ApiTags('auth')
@Controller('auth')
@UsePipes(new ValidationPipe({ whitelist: true }))
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(201)
  register(@Body() dto: RegisterBody) {
    return this.auth.register(dto).then(({ user, ...rest }) => ({
      user: { id: user.id, email: user.email, role: user.role },
      ...rest,
    }));
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginBody) {
    return this.auth.login(dto.email, dto.password).then(({ user, ...rest }) => ({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        role: user.role,
        isPlatformAdmin: user.isPlatformAdmin,
      },
      ...rest,
    }));
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: LogoutDto) {
    await this.auth.logout(dto.refreshToken);
  }

  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const result = await this.auth.requestPasswordReset(dto.email);
    return {
      ok: true,
      message: 'If that email exists, a reset link has been sent.',
      ...(result.devResetToken ? { devResetToken: result.devResetToken } : {}),
    };
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.newPassword);
    return { ok: true, message: 'Password updated. Please sign in again.' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('jwt')
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }
}
