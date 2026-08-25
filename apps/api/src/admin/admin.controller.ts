import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { VerificationType } from '@fleek/types';
import { Auth, CurrentUser } from '../auth/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/jwt-auth.guard';
import { WalletService } from '../wallet/wallet.service';

export class ReviewTopUpDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional() @IsString()
  note?: string;
}

export class SetPricingDto {
  @IsEnum(VerificationType)
  type!: VerificationType;

  /** Price in KES (e.g. 50 = KES 50.00). */
  @IsNumber() @Min(1)
  price!: number;
}

@ApiTags('admin')
@ApiBearerAuth('jwt')
@Controller('admin')
@Auth('OWNER')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  private assertPlatform(user: JwtPayload) {
    if (!user.isPlatformAdmin) {
      // Org OWNERs can manage their org; only platform admins manage everything.
      return user.organizationId;
    }
    return undefined;
  }

  @Get('stats')
  async stats(@CurrentUser() user: JwtPayload) {
    const orgId = this.assertPlatform(user);
    const [orgCount, verificationCount, pendingTopUps] = await Promise.all([
      orgId ? Promise.resolve(1) : this.prisma.client.organization.count(),
      this.prisma.client.verificationRequest.count({
        where: orgId ? { organizationId: orgId } : {},
      }),
      this.prisma.client.topUpRequest.count({
        where: { status: 'pending', ...(orgId ? { organizationId: orgId } : {}) },
      }),
    ]);
    return { organizations: orgCount, verifications: verificationCount, pendingTopUps };
  }

  @Get('organizations')
  listOrgs(@CurrentUser() user: JwtPayload) {
    return this.prisma.client.organization.findMany({
      where: user.isPlatformAdmin ? {} : { id: user.organizationId! },
      include: { wallet: true, _count: { select: { users: true } } },
    });
  }

  @Get('top-ups')
  allTopUps(
    @CurrentUser() user: JwtPayload,
    @Param('status') status?: 'pending' | 'approved' | 'rejected',
  ) {
    const orgId = user.isPlatformAdmin ? undefined : user.organizationId!;
    return this.wallet.listTopUps(orgId, status);
  }

  @Post('top-ups/:id/review')
  review(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReviewTopUpDto,
  ) {
    const orgScope = user.isPlatformAdmin ? undefined : user.organizationId!;
    return this.wallet.reviewTopUp(id, user.sub!, dto.approve, dto.note, orgScope);
  }

  @Get('pricing')
  pricing() {
    return this.prisma.client.productPricing.findMany();
  }

  @Post('pricing')
  async setPricing(@CurrentUser() user: JwtPayload, @Body() dto: SetPricingDto) {
    if (!user.isPlatformAdmin) {
      throw new ForbiddenException('Only platform admins can change pricing');
    }
    return this.prisma.client.productPricing.upsert({
      where: { type: dto.type },
      update: { priceMinor: BigInt(Math.round(dto.price * 100)) },
      create: { type: dto.type, priceMinor: BigInt(Math.round(dto.price * 100)) },
    });
  }
}
