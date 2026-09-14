import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  VerificationType,
  VERIFICATION_TYPES,
  PRODUCT_LABELS,
  PRODUCT_CATEGORIES,
  CB_CONSENT_REQUIRED_TYPES,
  type VerificationResult,
} from '@fleek/types';
import { AggregatorAdapter, ProviderRegistry, ProviderError } from '@fleek/providers';
import type { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InsufficientFundsException } from '../common/exceptions';

/** Scanned-statement runtime pricing (KES minor): base + per-page. PDF-exact. */
export const SCANNED_STATEMENT_BASE_MINOR = BigInt(12000);
export const SCANNED_STATEMENT_PAGE_MINOR = BigInt(400);
import { appConfig } from '../config/configuration';
import { RunVerificationDto } from './dto';

/** Live upstream wiring — credential-gated; absent config = full sandbox. */
function buildRegistry(): ProviderRegistry {
  const enabled = new Set(appConfig.enabledChecks);
  const {
    UPSTREAM_BASE_URL,
    UPSTREAM_API_KEY,
    LIVE_CHECKS,
    BACKUP_BASE_URL,
    BACKUP_API_KEY,
    BACKUP_CHECKS,
  } = process.env;

  if (!appConfig.useLiveUpstream || !UPSTREAM_BASE_URL || !UPSTREAM_API_KEY) {
    return new ProviderRegistry(enabled);
  }

  const liveTypes = new Set(
    (LIVE_CHECKS ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter((t): t is VerificationType => (VERIFICATION_TYPES as string[]).includes(t)),
  );

  let backupProvider: InstanceType<typeof AggregatorAdapter> | null = null;
  let backupTypes = new Set<VerificationType>();

  if (BACKUP_BASE_URL && BACKUP_API_KEY) {
    backupProvider = new AggregatorAdapter({ baseUrl: BACKUP_BASE_URL, apiKey: BACKUP_API_KEY });
    backupTypes = new Set(
      (BACKUP_CHECKS ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter((t): t is VerificationType => (VERIFICATION_TYPES as string[]).includes(t)),
    );
  }

  return new ProviderRegistry(
    enabled,
    new AggregatorAdapter({ baseUrl: UPSTREAM_BASE_URL, apiKey: UPSTREAM_API_KEY }),
    backupProvider,
    liveTypes,
    backupTypes,
  );
}

@Injectable()
export class VerificationsService {
  readonly registry: ProviderRegistry = buildRegistry();

  constructor(private readonly prisma: PrismaService) {}

  async products(organizationId?: string) {
    const pricing = await this.prisma.client.productPricing.findMany();
    const priceByType = new Map(pricing.map((p) => [p.type, p]));
    const overrides = await this.orgOverrides(organizationId);

    // Get current month for volume calculation
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let monthlyUsage = new Map<string, number>();
    if (organizationId) {
      const usage = await this.prisma.client.organizationMonthlyUsage.findMany({
        where: { orgId: organizationId, month: monthKey },
      });
      monthlyUsage = new Map(usage.map((u) => [u.productType, u.successCount]));
    }

    const results = await Promise.all(
      VERIFICATION_TYPES.map(async (type) => {
        const productPricing = priceByType.get(type);
        const currentVolume = monthlyUsage.get(type) ?? 0;
        const tier = await this.getCurrentTier(type, currentVolume);
        // Deployment-wide kill switch (ENABLED_CHECKS + global active flag).
        // Per-org rows can only opt OUT — they can never enable a check the
        // deployment disabled, so the UI needs this flag to avoid offering
        // toggles that cannot take effect.
        const deployEnabled = this.registry.isEnabled(type) && (productPricing?.active ?? false);
        const globalEnabled = deployEnabled;
        // Org opt-out: no row = enabled; explicit row controls availability.
        const orgCheck = overrides.enabled.get(type);
        const enabled = globalEnabled && (orgCheck ?? true);
        // Org pricing override (set in admin) replaces global tier prices.
        const orgTier = overrides.tiers.get(type);
        const unitMinor = orgTier
          ? BigInt(orgTier.unitPriceMinor)
          : (tier?.unitPriceMinor ?? productPricing?.priceMinor ?? null);
        // A backup price is only advertised when backup is actually routed;
        // otherwise the figure could never be charged.
        const hasBackup = this.registry.hasBackup(type);
        const backupMinor = hasBackup
          ? orgTier
            ? orgTier.backupPriceMinor != null
              ? BigInt(orgTier.backupPriceMinor)
              : null
            : (tier?.backupPriceMinor ?? null)
          : null;

        return {
          type,
          label: PRODUCT_LABELS[type],
          category: this.getCategory(type),
          enabled,
          deployEnabled,
          orgManaged: orgCheck !== undefined || orgTier !== undefined,
          live: this.registry.isLive(type),
          active: productPricing?.active ?? false,
          unitPriceKes: unitMinor != null ? Number(unitMinor) / 100 : null,
          backupPriceKes: backupMinor != null ? Number(backupMinor) / 100 : null,
          currentTier: tier
            ? {
                minVolume: tier.minVolume,
                maxVolume: tier.maxVolume,
                unitPriceMinor: Number(tier.unitPriceMinor),
                backupPriceMinor: tier.backupPriceMinor ? Number(tier.backupPriceMinor) : null,
              }
            : null,
          vatExclusive: tier?.vatExclusive ?? true,
          cbConsentRequired: CB_CONSENT_REQUIRED_TYPES.includes(type),
          requiresFileUpload: this.requiresFileUpload(type),
          fileTypes: this.getFileTypes(type),
          backupAvailable: hasBackup,
        };
      }),
    );
    return results;
  }

  private getCategory(type: VerificationType): string {
    for (const [category, types] of Object.entries(PRODUCT_CATEGORIES)) {
      if (types.includes(type)) return category;
    }
    return 'Other';
  }

  requiresFileUpload(type: VerificationType): boolean {
    return [
      VerificationType.FACE_ID_MATCH,
      VerificationType.SCANNED_STATEMENT,
      VerificationType.BRS,
    ].includes(type);
  }

  private getFileTypes(type: VerificationType): string[] {
    switch (type) {
      case VerificationType.FACE_ID_MATCH:
        return ['image/jpeg', 'image/png'];
      case VerificationType.SCANNED_STATEMENT:
        return ['application/pdf', 'image/jpeg', 'image/png'];
      case VerificationType.BRS:
        return ['application/pdf', 'image/jpeg', 'image/png'];
      default:
        return [];
    }
  }

  /** Per-org overrides set in admin. No row = global default (enabled, global pricing). */
  private async orgOverrides(organizationId?: string): Promise<{
    enabled: Map<VerificationType, boolean>;
    tiers: Map<VerificationType, { unitPriceMinor: number; backupPriceMinor: number | null }>;
  }> {
    const out = {
      enabled: new Map<VerificationType, boolean>(),
      tiers: new Map<
        VerificationType,
        { unitPriceMinor: number; backupPriceMinor: number | null }
      >(),
    };
    if (!organizationId) return out;
    const [checks, tiers] = await Promise.all([
      this.prisma.client.orgEnabledChecks.findMany({ where: { orgId: organizationId } }),
      this.prisma.client.orgPricingTier.findMany({ where: { orgId: organizationId } }),
    ]);
    for (const c of checks) out.enabled.set(c.productType as VerificationType, c.enabled);
    for (const t of tiers) {
      out.tiers.set(t.productType as VerificationType, {
        unitPriceMinor: t.unitPriceMinor,
        backupPriceMinor: t.backupPriceMinor,
      });
    }
    return out;
  }

  async getCurrentTier(
    type: VerificationType,
    volume: number,
    db: Pick<PrismaClient, 'productPricingTier'> = this.prisma.client,
  ) {
    return db.productPricingTier.findFirst({
      where: {
        productType: type,
        minVolume: { lte: volume },
        OR: [{ maxVolume: { gte: volume } }, { maxVolume: null }],
      },
      orderBy: { minVolume: 'desc' },
    });
  }

  async run(
    organizationId: string,
    dto: RunVerificationDto,
    source: 'dashboard' | 'api',
    userId?: string | null,
    apiKeyId?: string | null,
    batchId?: string | null,
  ) {
    if (!this.registry.isEnabled(dto.type)) {
      throw new BadRequestException(`Check "${dto.type}" is not available yet`);
    }

    // Check if product is active
    const productPricing = await this.prisma.client.productPricing.findUnique({
      where: { type: dto.type },
    });
    if (!productPricing?.active) throw new BadRequestException('Product not priced/inactive');

    // Enforce per-org availability set in admin (no row = enabled).
    const overrides = await this.orgOverrides(organizationId);
    if (overrides.enabled.get(dto.type) === false) {
      throw new BadRequestException(`Check "${dto.type}" is not enabled for your organization`);
    }

    // Check CB consent for required types
    if (CB_CONSENT_REQUIRED_TYPES.includes(dto.type) && !dto.cbConsent) {
      throw new BadRequestException(
        'Credit bureau consent (cbConsent) is required for this verification type',
      );
    }

    this.validateInput(dto);

    // Get current month volume for tier pricing
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const usage = await this.prisma.client.organizationMonthlyUsage.findUnique({
      where: {
        orgId_month_productType: { orgId: organizationId, month: monthKey, productType: dto.type },
      },
    });
    const currentVolume = usage?.successCount ?? 0;

    // Get tier pricing (org override from admin wins over global tiers).
    // A missing tier (e.g. an admin-created gap) falls back to the base
    // product price instead of 400ing a billable check. This pre-read is only
    // a quote for the backup offer — the locked tier inside the transaction
    // decides the actual charge.
    const tier = await this.getCurrentTier(dto.type, currentVolume);
    const orgTier = overrides.tiers.get(dto.type);
    const tierBackupPriceMinor = orgTier
      ? orgTier.backupPriceMinor != null
        ? BigInt(orgTier.backupPriceMinor)
        : null
      : (tier?.backupPriceMinor ?? null);

    // Determine if using backup. resolve() falls through to primary/mock when
    // no backup is routed, so the record must reflect what actually served —
    // not what was requested.
    const useBackup = dto.useBackup === true;
    const backupRouted = useBackup && this.registry.hasBackup(dto.type);

    const startedAt = Date.now();
    let result: VerificationResult | null = null;
    let status: 'success' | 'not_found' | 'failed' = 'success';
    let errorMessage: string | null = null;
    let isBackup = false;
    let backupAvailable = false;
    let backupPriceMinor: bigint | null = null;

    try {
      const provider = this.registry.resolve(dto.type, useBackup);
      isBackup = backupRouted;

      result = await this.executeVerification(provider, dto);
    } catch (err) {
      if (err instanceof ProviderError) {
        if (err.code === 'NOT_FOUND') {
          status = 'not_found';
        } else if (
          err.code === 'UPSTREAM_DOWN' &&
          !useBackup &&
          this.registry.hasBackup(dto.type) &&
          tierBackupPriceMinor != null
        ) {
          // Primary failed and a priced backup is routed — offer the retry.
          // Without a known backup price the offer would be a blank cheque.
          status = 'failed';
          errorMessage = err.message;
          backupAvailable = true;
          backupPriceMinor = tierBackupPriceMinor;
        } else {
          status = 'failed';
          errorMessage = err.message;
        }
      } else {
        status = 'failed';
        errorMessage = 'Upstream verification error';
      }
    }

    // Charge + record atomically. Volume and wallet balance are re-read under
    // row locks inside the transaction: the pre-provider tier above is only a
    // quote (backup offer), while the locked tier decides the actual charge.
    // This keeps concurrent runs from billing a stale tier at band boundaries
    // and from overdrawing a wallet drained mid-flight.
    let costMinor = BigInt(0);

    const record = await this.prisma.client.$transaction(async (tx) => {
      const usageKey = {
        orgId: organizationId,
        month: monthKey,
        productType: dto.type,
      };
      await tx.organizationMonthlyUsage.upsert({
        where: { orgId_month_productType: usageKey },
        update: {},
        create: { ...usageKey, successCount: 0 },
      });
      const lockedUsage = await tx.$queryRaw<{ volume: number }[]>`
        SELECT "success_count" AS "volume" FROM "organization_monthly_usage"
        WHERE "org_id" = ${organizationId} AND "month" = ${monthKey}
          AND "product_type" = ${dto.type}::"VerificationType" FOR UPDATE`;
      const lockedVolume = lockedUsage[0]?.volume ?? 0;
      const lockedTier = await this.getCurrentTier(dto.type, lockedVolume, tx);
      let lockedUnit = orgTier
        ? BigInt(orgTier.unitPriceMinor)
        : (lockedTier?.unitPriceMinor ?? productPricing.priceMinor);
      // Scanned statements are priced at runtime, not tiered (PDF-exact):
      // KES 120 base + KES 4 per page. An explicit org override still wins.
      if (dto.type === VerificationType.SCANNED_STATEMENT && !orgTier) {
        lockedUnit =
          SCANNED_STATEMENT_BASE_MINOR +
          SCANNED_STATEMENT_PAGE_MINOR * BigInt(dto.statementPages ?? 1);
      }
      const lockedBackup = orgTier
        ? orgTier.backupPriceMinor != null
          ? BigInt(orgTier.backupPriceMinor)
          : null
        : (lockedTier?.backupPriceMinor ?? null);

      if (status === 'success') {
        costMinor = isBackup && lockedBackup ? lockedBackup : lockedUnit;
      }

      if (costMinor > 0) {
        const lockedWallets = await tx.$queryRaw<{ id: string; balanceMinor: bigint }[]>`
          SELECT "id", "balanceMinor" FROM "wallets"
          WHERE "organizationId" = ${organizationId} FOR UPDATE`;
        const lockedWallet = lockedWallets[0];
        if (!lockedWallet || lockedWallet.balanceMinor < costMinor) {
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
            description: `${dto.type} verification${isBackup ? ' (backup)' : ''}`,
            walletId: updated.id,
          },
        });
      }

      // Update monthly usage counter on success (row exists by construction)
      if (status === 'success') {
        await tx.organizationMonthlyUsage.update({
          where: { orgId_month_productType: usageKey },
          data: { successCount: { increment: 1 } },
        });
      }

      // Prepare encrypted input - include all relevant fields
      const inputData = {
        idNumber: dto.idNumber,
        kraPin: dto.kraPin,
        phoneNumber: dto.phoneNumber,
        alienId: dto.alienId,
        passportNumber: dto.passportNumber,
        nationality: dto.nationality,
        bankCode: dto.bankCode,
        accountNumber: dto.accountNumber,
        employerName: dto.employerName,
        meterNumber: dto.meterNumber,
        vehicleRegNumber: dto.vehicleRegNumber,
        dlNumber: dto.dlNumber,
        businessRegNumber: dto.businessRegNumber,
        faceImageBase64: dto.faceImageBase64 ? '[REDACTED]' : undefined,
        statementPages: dto.statementPages,
        cbConsent: dto.cbConsent,
        useBackup: dto.useBackup,
      };

      return tx.verificationRequest.create({
        data: {
          type: dto.type,
          status,
          source,
          encryptedInput: this.prisma.encrypt(JSON.stringify(inputData)),
          encryptedResult: result ? this.prisma.encrypt(JSON.stringify(result)) : null,
          costMinor,
          latencyMs: Date.now() - startedAt,
          errorMessage,
          consent: dto.consent,
          consentCollectedBy: dto.consentCollectedBy,
          cbConsent: dto.cbConsent ?? false,
          isBackup,
          organizationId,
          userId: userId ?? null,
          apiKeyId: apiKeyId ?? null,
          batchId: batchId ?? null,
        },
      });
    });

    return {
      id: record.id,
      type: dto.type,
      status: record.status,
      result: result as VerificationResult | null,
      errorMessage,
      cost: Number(costMinor) / 100,
      latencyMs: Date.now() - startedAt,
      createdAt: record.createdAt.toISOString(),
      isBackup,
      backupAvailable,
      backupPrice: backupPriceMinor ? Number(backupPriceMinor) / 100 : undefined,
    };
  }

  private async executeVerification(
    provider: ReturnType<ProviderRegistry['resolve']>,
    dto: RunVerificationDto,
  ): Promise<VerificationResult> {
    switch (dto.type) {
      // Identity — Standard
      case VerificationType.IPRS_STANDARD:
        return provider.iprsStandardLookup(dto.idNumber!);
      case VerificationType.MATCH_ID_PHONE:
        return provider.matchIdPhone({ idNumber: dto.idNumber!, phoneNumber: dto.phoneNumber! });
      case VerificationType.EMPLOYER_VERIFICATION:
        return provider.employerVerification({
          idNumber: dto.idNumber!,
          employerName: dto.employerName!,
        });
      case VerificationType.FACE_ID_MATCH:
        return provider.faceIdMatch({
          idNumber: dto.idNumber!,
          faceImageBase64: dto.faceImageBase64!,
        });
      case VerificationType.BANK_ACCOUNT_VERIFICATION:
        return provider.bankAccountVerification({
          accountNumber: dto.accountNumber!,
          bankCode: dto.bankCode!,
          idNumber: dto.idNumber,
        });

      // Identity — Premium
      case VerificationType.ALIEN_ID:
        return provider.alienIdLookup({ alienId: dto.alienId! });
      case VerificationType.AML_PEP_SCREEN:
        return provider.amlPepScreen(dto.idNumber!);
      case VerificationType.PASSPORT_CHECK:
        return provider.passportCheck({
          passportNumber: dto.passportNumber!,
          nationality: dto.nationality!,
        });

      // Utility
      case VerificationType.SIM_SWAP_CHECK:
        return provider.simSwapCheck(dto.phoneNumber!);
      case VerificationType.KPLC_LOCATION_CHECKER:
        return provider.kplcLocationChecker({ meterNumber: dto.meterNumber! });
      case VerificationType.KRA_PIN_VERIFICATION:
        return provider.kraPinCheck({ kraPin: dto.kraPin, idNumber: dto.idNumber });
      case VerificationType.SEARCH_NAME_BY_PHONE:
        return provider.searchNameByPhone(dto.phoneNumber!);

      // Identity & CRB
      case VerificationType.SEARCH_PHONES_BY_ID:
        return provider.searchPhonesById(dto.idNumber!);

      // Vehicle
      case VerificationType.MOTOR_VEHICLE_OWNERSHIP:
        return provider.motorVehicleOwnership({ vehicleRegNumber: dto.vehicleRegNumber! });
      case VerificationType.DRIVERS_LICENSE_VERIFICATION:
        return provider.driversLicenseVerification({ dlNumber: dto.dlNumber! });

      // Credit Reference — Metropol
      case VerificationType.METROPOL_SCORE_ONLY:
        return provider.metropolScoreOnly(dto.idNumber!);
      case VerificationType.METROPOL_STANDARD_REPORT:
        return provider.metropolStandardReport(dto.idNumber!);
      case VerificationType.METROPOL_FULL_REPORT:
        return provider.metropolFullReport(dto.idNumber!);

      // Credit Reference — CreditInfo
      case VerificationType.CREDITINFO_SCORE_ONLY:
        return provider.creditInfoScoreOnly(dto.idNumber!);
      case VerificationType.CREDITINFO_COMPREHENSIVE:
        return provider.creditInfoComprehensive(dto.idNumber!);
      case VerificationType.CREDITINFO_CRB_STATUS:
        return provider.creditInfoCrbStatus(dto.idNumber!);

      // KYB
      case VerificationType.BRS:
        return provider.brsLookup({ businessRegNumber: dto.businessRegNumber! });

      // Analytics
      case VerificationType.SPIN_SCORE_ONLY:
        return provider.spinScoreOnly(dto.idNumber!);
      case VerificationType.SCANNED_STATEMENT:
        return provider.scannedStatementAnalysis({
          statementPages: dto.statementPages!,
          fileBase64: dto.statementFileBase64,
        });

      default:
        throw new BadRequestException(`Unknown verification type: ${dto.type}`);
    }
  }

  async history(
    orgId: string,
    opts: {
      type?: VerificationType;
      limit: number;
      offset: number;
      from?: string;
      to?: string;
      status?: string;
      search?: string;
    },
  ) {
    const where: Record<string, unknown> = { organizationId: orgId };
    if (opts.type) where.type = opts.type;
    if (opts.status) where.status = opts.status;
    if (opts.from || opts.to) {
      where.createdAt = {};
      if (opts.from) (where.createdAt as Record<string, Date>).gte = new Date(opts.from);
      if (opts.to) (where.createdAt as Record<string, Date>).lte = new Date(opts.to);
    }
    const search = opts.search?.trim();
    if (search) {
      const lower = search.toLowerCase();
      const matchingTypes = VERIFICATION_TYPES.filter((t) => t.toLowerCase().includes(lower));
      const statusValues = ['pending', 'success', 'not_found', 'failed'] as const;
      const matchingStatuses = statusValues.filter((s) => s.includes(lower));
      const or: Record<string, unknown>[] = [
        { id: { contains: search, mode: 'insensitive' } },
        { source: { contains: search, mode: 'insensitive' } },
      ];
      if (matchingTypes.length) or.push({ type: { in: matchingTypes } });
      if (matchingStatuses.length) or.push({ status: { in: matchingStatuses } });
      where.OR = or;
    }

    const [items, total] = await Promise.all([
      this.prisma.client.verificationRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(opts.limit, 200),
        skip: opts.offset,
        select: {
          id: true,
          type: true,
          status: true,
          source: true,
          costMinor: true,
          latencyMs: true,
          createdAt: true,
          encryptedInput: true,
          isBackup: true,
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
        isBackup: it.isBackup,
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
      cbConsent: it.cbConsent,
      isBackup: it.isBackup,
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
      // Identity — Standard
      case VerificationType.IPRS_STANDARD:
      case VerificationType.EMPLOYER_VERIFICATION:
      case VerificationType.FACE_ID_MATCH:
      case VerificationType.AML_PEP_SCREEN:
      case VerificationType.METROPOL_SCORE_ONLY:
      case VerificationType.METROPOL_STANDARD_REPORT:
      case VerificationType.METROPOL_FULL_REPORT:
      case VerificationType.CREDITINFO_SCORE_ONLY:
      case VerificationType.CREDITINFO_COMPREHENSIVE:
      case VerificationType.CREDITINFO_CRB_STATUS:
      case VerificationType.SPIN_SCORE_ONLY:
      case VerificationType.SEARCH_PHONES_BY_ID:
        if (!dto.idNumber) throw new BadRequestException('idNumber is required');
        break;
      case VerificationType.MATCH_ID_PHONE:
        if (!dto.idNumber || !dto.phoneNumber)
          throw new BadRequestException('idNumber and phoneNumber are required');
        break;
      case VerificationType.BANK_ACCOUNT_VERIFICATION:
        if (!dto.accountNumber || !dto.bankCode)
          throw new BadRequestException('accountNumber and bankCode are required');
        break;
      // Identity — Premium
      case VerificationType.ALIEN_ID:
        if (!dto.alienId) throw new BadRequestException('alienId is required');
        break;
      case VerificationType.PASSPORT_CHECK:
        if (!dto.passportNumber || !dto.nationality)
          throw new BadRequestException('passportNumber and nationality are required');
        break;
      // Utility
      case VerificationType.SIM_SWAP_CHECK:
      case VerificationType.SEARCH_NAME_BY_PHONE:
        if (!dto.phoneNumber) throw new BadRequestException('phoneNumber is required');
        break;
      case VerificationType.KPLC_LOCATION_CHECKER:
        if (!dto.meterNumber) throw new BadRequestException('meterNumber is required');
        break;
      case VerificationType.KRA_PIN_VERIFICATION:
        if (!dto.kraPin && !dto.idNumber)
          throw new BadRequestException('kraPin or idNumber is required');
        break;
      // Vehicle
      case VerificationType.MOTOR_VEHICLE_OWNERSHIP:
        if (!dto.vehicleRegNumber) throw new BadRequestException('vehicleRegNumber is required');
        break;
      case VerificationType.DRIVERS_LICENSE_VERIFICATION:
        if (!dto.dlNumber) throw new BadRequestException('dlNumber is required');
        break;
      // KYB
      case VerificationType.BRS:
        if (!dto.businessRegNumber) throw new BadRequestException('businessRegNumber is required');
        break;
      // Analytics
      case VerificationType.SCANNED_STATEMENT:
        if (!dto.statementPages || dto.statementPages < 1)
          throw new BadRequestException('statementPages must be at least 1');
        break;
    }
  }

  /**
   * Select a pricing tier in memory from a pre-sorted desc-by-minVolume list.
   * Tiers: { minVolume, maxVolume, unitPriceMinor, backupPriceMinor, vatExclusive }
   * Returns the first tier where minVolume <= volume AND (maxVolume is null OR maxVolume >= volume).
   * Falls through to the topmost open-ended tier if no tighter match.
   * Returns null if volume is below the smallest tier's minVolume.
   */
  static selectTierInMemory(
    tiers: {
      minVolume: number;
      maxVolume: number | null;
      unitPriceMinor: bigint;
      backupPriceMinor: bigint | null;
      vatExclusive: boolean;
    }[],
    volume: number,
  ): {
    unitPriceMinor: bigint;
    backupPriceMinor: bigint | null;
    minVolume: number;
    maxVolume: number | null;
    vatExclusive: boolean;
  } | null {
    // Primary loop: find first tier where minVolume <= volume <= maxVolume (or null maxVolume)
    for (const tier of tiers) {
      if (tier.minVolume <= volume && (tier.maxVolume === null || tier.maxVolume >= volume)) {
        return {
          unitPriceMinor: tier.unitPriceMinor,
          backupPriceMinor: tier.backupPriceMinor,
          minVolume: tier.minVolume,
          maxVolume: tier.maxVolume,
          vatExclusive: tier.vatExclusive,
        };
      }
    }
    // Volume is below all tiers' minVolume → return null
    if (tiers.length > 0 && volume < tiers[tiers.length - 1].minVolume) {
      return null;
    }
    // Fallback: return the first tier (highest minVolume = "topmost open-ended")
    // since volume >= all minVolumes and no tighter match was found
    const fallback = tiers[0];
    if (fallback) {
      return {
        unitPriceMinor: fallback.unitPriceMinor,
        backupPriceMinor: fallback.backupPriceMinor,
        minVolume: fallback.minVolume,
        maxVolume: fallback.maxVolume,
        vatExclusive: fallback.vatExclusive,
      };
    }
    return null;
  }

  private summarizeSubject(encryptedInput: string): string {
    try {
      const input = JSON.parse(this.prisma.decrypt(encryptedInput)) as Record<
        string,
        string | number | null | undefined
      >;
      const subject =
        input.kraPin ??
        input.phoneNumber ??
        input.idNumber ??
        input.alienId ??
        input.passportNumber ??
        input.vehicleRegNumber ??
        input.dlNumber ??
        input.businessRegNumber ??
        input.meterNumber ??
        (input.statementPages ? String(input.statementPages) : '—');
      return String(subject);
    } catch {
      return '—';
    }
  }
}
