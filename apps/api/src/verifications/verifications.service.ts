import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { VerificationType, VERIFICATION_TYPES } from '@fleek/types';
import { ProviderRegistry, ProviderError } from '@fleek/providers';
import { PrismaService } from '../prisma/prisma.service';
import { InsufficientFundsException } from '../common/exceptions';
import { appConfig } from '../config/configuration';
import { RunVerificationDto } from './dto';

@Injectable()
export class VerificationsService {
  readonly registry: ProviderRegistry;

  constructor(private readonly prisma: PrismaService) {
    this.registry = new ProviderRegistry(
      new Set(appConfig.enabledChecks),
      appConfig.useLiveUpstream,
    );
  }

  async products(organizationId?: string) {
    const pricing = await this.prisma.client.productPricing.findMany();
    const priceByType = new Map(pricing.map((p) => [p.type, p.priceMinor.toString()]));
    return VERIFICATION_TYPES.map((type) => ({
      type,
      enabled: this.registry.isEnabled(type),
      priceMinor: priceByType.get(type) ?? null,
    }));
  }

  async run(
    organizationId: string,
    dto: RunVerificationDto,
    source: 'dashboard' | 'api',
    userId?: string | null,
    apiKeyId?: string | null,
  ) {
    if (!this.registry.isEnabled(dto.type)) {
      throw new BadRequestException(`Check "${dto.type}" is not available yet`);
    }
    this.validateInput(dto);

    const pricing = await this.prisma.client.productPricing.findUnique({ where: { type: dto.type } });
    if (!pricing?.active) throw new BadRequestException('Product not priced/inactive');

    const startedAt = Date.now();
    let result: object | null = null;
    let status: 'success' | 'not_found' | 'failed' = 'success';
    let errorMessage: string | null = null;

    try {
      const provider = this.registry.resolve(dto.type);
      switch (dto.type) {
        case VerificationType.IPRS_ID:
          result = await provider.iprsIdLookup(dto.idNumber!);
          break;
        case VerificationType.KRA_PIN:
          result = await provider.kraPinCheck({ kraPin: dto.kraPin, idNumber: dto.idNumber });
          break;
        case VerificationType.PHONE_OWNERSHIP:
          result = await provider.phoneOwnership({
            phoneNumber: dto.phoneNumber,
            idNumber: dto.idNumber,
          });
          break;
        case VerificationType.SIM_SWAP:
          result = await provider.simSwapCheck(dto.phoneNumber!);
          break;
      }
    } catch (err) {
      if (err instanceof ProviderError) {
        status = err.code === 'NOT_FOUND' ? 'not_found' : 'failed';
        errorMessage = err.message;
      } else {
        status = 'failed';
        errorMessage = 'Upstream verification error';
      }
    }

    // Failed lookups are never billed; successful ones deduct from wallet atomically.
    const costMinor = status === 'success' ? pricing.priceMinor : BigInt(0);

    const record = await this.prisma.client.$transaction(async (tx) => {
      if (costMinor > 0) {
        const wallet = await tx.wallet.findUnique({ where: { organizationId } });
        if (!wallet || wallet.balanceMinor < costMinor) {
          throw new InsufficientFundsException();
        }
        const updated = await tx.wallet.update({
          where: { organizationId },
          data: { balanceMinor: { decrement: costMinor } },
        });
        await tx.transaction.create({
          data: {
            type: 'charge',
            amountMinor: costMinor,
            balanceAfter: updated.balanceMinor,
            description: `${dto.type} verification`,
            walletId: updated.id,
          },
        });
      }
      return tx.verificationRequest.create({
        data: {
          type: dto.type,
          status,
          source,
          encryptedInput: this.prisma.encrypt(
            JSON.stringify({ idNumber: dto.idNumber, kraPin: dto.kraPin, phoneNumber: dto.phoneNumber }),
          ),
          encryptedResult: result ? this.prisma.encrypt(JSON.stringify(result)) : null,
          costMinor,
          latencyMs: Date.now() - startedAt,
          errorMessage,
          consent: dto.consent,
          consentCollectedBy: dto.consentCollectedBy,
          organizationId,
          userId: userId ?? null,
          apiKeyId: apiKeyId ?? null,
        },
      });
    });

    return {
      id: record.id,
      type: dto.type,
      status: record.status,
      result: result as import('@fleek/types').VerificationResult | null,
      errorMessage,
      cost: Number(costMinor) / 100,
      latencyMs: Date.now() - startedAt,
      createdAt: record.createdAt.toISOString(),
    };
  }

  async history(orgId: string, opts: { type?: VerificationType; limit: number; offset: number }) {
    const where = { organizationId: orgId, ...(opts.type ? { type: opts.type } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.client.verificationRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(opts.limit, 200),
        skip: opts.offset,
        select: {
          id: true, type: true, status: true, source: true, costMinor: true,
          latencyMs: true, createdAt: true, encryptedInput: true,
        },
      }),
      this.prisma.client.verificationRequest.count({ where }),
    ]);

    return {
      total,
      items: items.map((it) => ({
        id: it.id,
        type: it.type,
        status: it.status,
        source: it.source,
        cost: Number(it.costMinor) / 100,
        latencyMs: it.latencyMs,
        createdAt: it.createdAt.toISOString(),
        subject: this.summarizeSubject(it.encryptedInput),
      })),
    };
  }

  async detail(orgId: string, id: string) {
    const it = await this.prisma.client.verificationRequest.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!it) throw new NotFoundException('Verification not found');
    return {
      id: it.id,
      type: it.type,
      status: it.status,
      source: it.source,
      consent: it.consent,
      consentCollectedBy: it.consentCollectedBy,
      input: JSON.parse(this.prisma.decrypt(it.encryptedInput)),
      result: it.encryptedResult ? JSON.parse(this.prisma.decrypt(it.encryptedResult)) : null,
      errorMessage: it.errorMessage,
      cost: Number(it.costMinor) / 100,
      latencyMs: it.latencyMs,
      createdAt: it.createdAt.toISOString(),
    };
  }

  private validateInput(dto: RunVerificationDto) {
    switch (dto.type) {
      case VerificationType.IPRS_ID:
        if (!dto.idNumber) throw new BadRequestException('idNumber is required');
        break;
      case VerificationType.KRA_PIN:
        if (!dto.kraPin && !dto.idNumber) {
          throw new BadRequestException('kraPin or idNumber is required');
        }
        break;
      case VerificationType.PHONE_OWNERSHIP:
        if (!dto.phoneNumber && !dto.idNumber) {
          throw new BadRequestException('phoneNumber or idNumber is required');
        }
        break;
      case VerificationType.SIM_SWAP:
        if (!dto.phoneNumber) throw new BadRequestException('phoneNumber is required');
        break;
    }
  }

  private summarizeSubject(encryptedInput: string): string {
    try {
      const input = JSON.parse(this.prisma.decrypt(encryptedInput)) as Record<string, string | null>;
      return input.kraPin ?? input.phoneNumber ?? input.idNumber ?? '—';
    } catch {
      return '—';
    }
  }
}
