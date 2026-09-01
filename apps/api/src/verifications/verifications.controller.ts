import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { VerificationType, type VerificationResponse } from '@fleek/types';
import { Auth, CurrentUser } from '../auth/auth.decorators';
import { AnyAuthGuard } from '../auth/api-key.guard';
import type { JwtPayload } from '../auth/jwt-auth.guard';
import { VerificationsService } from './verifications.service';
import { ListVerificationsQuery, RunVerificationDto } from './dto';

const CurrentApiKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => ctx.switchToHttp().getRequest()['apiKey']?.id ?? null,
);

@ApiTags('verifications')
@ApiBearerAuth('jwt')
@ApiSecurity('apiKey')
@Controller('verifications')
export class VerificationsController {
  constructor(private readonly verifications: VerificationsService) {}

  @Get('products')
  @ApiOperation({ summary: 'List verification products with pricing & availability' })
  async products(@CurrentUser() user: JwtPayload | null) {
    return this.verifications.products(user?.organizationId ?? undefined);
  }

  @Post()
  @UseGuards(AnyAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'faceImage', maxCount: 1 },
      { name: 'statementFile', maxCount: 1 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Run a verification (dashboard JWT session or API key)' })
  async run(
    @Body() dto: RunVerificationDto,
    @CurrentUser() user: JwtPayload,
    @CurrentApiKey() apiKeyId: string | null,
  ): Promise<VerificationResponse> {
    if (!user.organizationId) throw new BadRequestException('No organization context');
    const res = await this.verifications.run(
      user.organizationId,
      dto,
      user.role === 'API' ? 'api' : 'dashboard',
      user.sub,
      apiKeyId,
    );
    return {
      id: res.id,
      type: res.type,
      status: res.status,
      result: res.result,
      cost: res.cost,
      createdAt: res.createdAt,
      isBackup: res.isBackup,
      backupAvailable: res.backupAvailable,
      backupPrice: res.backupPrice,
    };
  }

  @Get()
  @Auth('OWNER', 'ADMIN', 'MEMBER')
  history(@CurrentUser() user: JwtPayload, @Query() query: ListVerificationsQuery) {
    return this.verifications.history(user.organizationId!, {
      type: query.type as VerificationType | undefined,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
      from: query.from,
      to: query.to,
      status: query.status,
    });
  }

  @Get(':id')
  @Auth('OWNER', 'ADMIN', 'MEMBER')
  detail(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.verifications.detail(user.organizationId!, id);
  }
}