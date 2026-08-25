import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';
import { Auth, CurrentUser } from '../auth/auth.decorators';
import { AuthService } from '../auth/auth.service';
import type { JwtPayload } from '../auth/jwt-auth.guard';

export class CreateKeyDto {
  @IsString() @MinLength(2)
  name!: string;

  @IsIn(['live', 'test'])
  environment!: 'live' | 'test';
}

@ApiTags('api-keys')
@ApiBearerAuth('jwt')
@Controller('keys')
export class ApiKeysController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  @Auth('OWNER', 'ADMIN')
  list(@CurrentUser() user: JwtPayload) {
    return this.auth.listApiKeys(user.organizationId!);
  }

  @Post()
  @Auth('OWNER', 'ADMIN')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateKeyDto) {
    return this.auth.createApiKey(user.organizationId!, dto.name, dto.environment);
  }

  @Delete(':id')
  @Auth('OWNER', 'ADMIN')
  revoke(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.auth.revokeApiKey(user.organizationId!, id);
  }
}
