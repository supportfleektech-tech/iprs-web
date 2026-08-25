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

class RefreshDto {
  @IsString() @IsNotEmpty()
  refreshToken!: string;
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
      user: { id: user.id, email: user.email, firstName: user.firstName, role: user.role, isPlatformAdmin: user.isPlatformAdmin },
      ...rest,
    }));
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('jwt')
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }
}
