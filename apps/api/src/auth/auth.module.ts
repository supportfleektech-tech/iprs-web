import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ApiKeysController } from '../api-keys/api-keys.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiKeyGuard } from './api-key.guard';
import { RolesGuard } from './roles.guard';
import { MAILER, buildMailer } from '../common/mailer';
import { appConfig } from '../config/configuration';

@Module({
  imports: [
    JwtModule.register({
      secret: appConfig.jwtSecret,
      signOptions: { expiresIn: appConfig.jwtExpiresIn },
    }),
  ],
  controllers: [AuthController, ApiKeysController],
  providers: [
    AuthService,
    JwtAuthGuard,
    ApiKeyGuard,
    RolesGuard,
    { provide: MAILER, useFactory: buildMailer },
  ],
  exports: [AuthService, JwtAuthGuard, ApiKeyGuard, JwtModule],
})
export class AuthModule {}
