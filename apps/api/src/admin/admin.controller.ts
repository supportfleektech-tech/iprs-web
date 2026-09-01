import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
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

export class SetProductActiveDto {
  @IsBoolean()
  active!: boolean;
}

export class CreateTierDto {
  @IsEnum(VerificationType)
  productType!: VerificationType;

  @IsNumber() @Min(0)
  minVolume!: number;

  @IsOptional() @IsNumber() @Min(1)
  maxVolume?: number | null;

  @IsNumber() @Min(1)
  unitPriceMinor!: number;

  @IsOptional() @IsNumber() @Min(1)
  backupPriceMinor?: number | null;

  @IsOptional() @IsBoolean()
  vatExclusive?: boolean = true;
}

export class UpdateTierDto {
  @IsOptional() @IsNumber() @Min(1)
  maxVolume?: number | null;

  @IsOptional() @IsNumber() @Min(1)
  unitPriceMinor?: number;

  @IsOptional() @IsNumber() @Min(1)
  backupPriceMinor?: number | null;

  @IsOptional() @IsBoolean()
  vatExclusive?: boolean;
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
    @Query('status') status?: 'pending' | 'approved' | 'rejected',
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

  // Product active toggle
  @Get('products')
  async listProducts(@CurrentUser() user: JwtPayload) {
    if (!user.isPlatformAdmin) {
      throw new ForbiddenException('Only platform admins can manage products');
    }
    return this.prisma.client.productPricing.findMany({
      orderBy: { type: 'asc' },
    });
  }

  @Put('products/:type/active')
  async setProductActive(
    @CurrentUser() user: JwtPayload,
    @Param('type') type: VerificationType,
    @Body() dto: SetProductActiveDto,
  ) {
    if (!user.isPlatformAdmin) {
      throw new ForbiddenException('Only platform admins can change product availability');
    }
    return this.prisma.client.productPricing.upsert({
      where: { type },
      update: { active: dto.active },
      create: { type, active: dto.active, priceMinor: BigInt(0) },
    });
  }

  // Tier pricing CRUD
  @Get('pricing/tiers')
  async listTiers(@CurrentUser() user: JwtPayload, @Query('type') type?: VerificationType) {
    if (!user.isPlatformAdmin) {
      throw new ForbiddenException('Only platform admins can view pricing tiers');
    }
    return this.prisma.client.productPricingTier.findMany({
      where: type ? { productType: type } : {},
      orderBy: [{ productType: 'asc' }, { minVolume: 'asc' }],
    });
  }

  @Post('pricing/tiers')
  async createTier(@CurrentUser() user: JwtPayload, @Body() dto: CreateTierDto) {
    if (!user.isPlatformAdmin) {
      throw new ForbiddenException('Only platform admins can create pricing tiers');
    }
    return this.prisma.client.productPricingTier.create({
      data: {
        productType: dto.productType,
        minVolume: dto.minVolume,
        maxVolume: dto.maxVolume ?? null,
        unitPriceMinor: BigInt(dto.unitPriceMinor),
        backupPriceMinor: dto.backupPriceMinor ? BigInt(dto.backupPriceMinor) : null,
        vatExclusive: dto.vatExclusive ?? true,
      },
    });
  }

  @Put('pricing/tiers/:id')
  async updateTier(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTierDto,
  ) {
    if (!user.isPlatformAdmin) {
      throw new ForbiddenException('Only platform admins can update pricing tiers');
    }
    return this.prisma.client.productPricingTier.update({
      where: { id },
      data: {
        maxVolume: dto.maxVolume ?? undefined,
        unitPriceMinor: dto.unitPriceMinor ? BigInt(dto.unitPriceMinor) : undefined,
        backupPriceMinor: dto.backupPriceMinor !== undefined ? (dto.backupPriceMinor ? BigInt(dto.backupPriceMinor) : null) : undefined,
        vatExclusive: dto.vatExclusive ?? undefined,
      },
    });
  }
}