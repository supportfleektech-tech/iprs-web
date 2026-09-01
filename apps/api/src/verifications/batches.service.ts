import { Injectable, BadRequestException } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { VerificationType } from '@fleek/types';
import type { VerificationBatch } from '@fleek/database';
import { PrismaService } from '../prisma/prisma.service';
import { InsufficientFundsException } from '../common/exceptions';
import { VerificationsService } from './verifications.service';
import type { CreateBatchDto, CsvRow } from './bulk.dto';

const MAX_ROWS = 1000;
const CONCURRENCY = 5;

export interface BatchSummary {
  id: string;
  type: VerificationType;
  status: string;
  totalRows: number;
  processedRows: number;
  successCount: number;
  failedCount: number;
  notFoundCount: number;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

@Injectable()
export class BatchesService {
  private readonly logger = new Logger('BatchesService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly verifications: VerificationsService,
  ) {}

  async createBatch(orgId: string, userId: string, dto: CreateBatchDto): Promise<BatchSummary> {
    if (!this.verifications.registry.isEnabled(dto.type)) {
      throw new BadRequestException(`Check "${dto.type}" is not available`);
    }
    
    // Filter rows with at least one identifier
    const rows = dto.rows.filter((r) => r.idNumber || r.phoneNumber || r.kraPin || r.alienId || r.passportNumber || r.meterNumber || r.vehicleRegNumber || r.dlNumber || r.businessRegNumber);
    if (rows.length === 0) {
      throw new BadRequestException('No usable rows found — expected columns like id_number or phone_number');
    }
    if (rows.length > MAX_ROWS) {
      throw new BadRequestException(`A batch may contain at most ${MAX_ROWS} rows (got ${rows.length})`);
    }

    // For batch, we estimate cost using the base tier price (will be actual per-row at runtime)
    const productPricing = await this.prisma.client.productPricing.findUnique({ where: { type: dto.type } });
    const wallet = await this.prisma.client.wallet.findUnique({ where: { organizationId: orgId } });
    const basePriceMinor = productPricing?.priceMinor ?? BigInt(0);
    if (!productPricing?.active) throw new BadRequestException('Product not priced/inactive');
    // Estimate max cost (all rows succeed at highest tier - conservative)
    const tier = await this.verifications.getCurrentTier(dto.type, 0);
    const estimatedPriceMinor = tier?.unitPriceMinor ?? basePriceMinor;
    
    if (!wallet || wallet.balanceMinor < estimatedPriceMinor * BigInt(rows.length)) {
      throw new InsufficientFundsException(
        `Estimated cost KES ${(Number(estimatedPriceMinor * BigInt(rows.length)) / 100).toLocaleString()} exceeds wallet balance` +
          (wallet ? ` (KES ${(Number(wallet.balanceMinor) / 100).toLocaleString()})` : ''),
      );
    }

    const batch = await this.prisma.client.verificationBatch.create({
      data: {
        type: dto.type,
        totalRows: rows.length,
        organizationId: orgId,
        userId,
      },
    });

    void this.processBatch(batch.id, orgId, userId, dto.type, dto.consentCollectedBy, rows);

    return this.toSummary(batch);
  }

  /**
   * Processes rows through the same single-verification pipeline used by the
   * console and API (billing, encryption, audit). Runs in-process with bounded
   * concurrency; progress lands in the DB so clients can poll.
   */
  private async processBatch(
    batchId: string,
    orgId: string,
    userId: string,
    type: VerificationType,
    consentCollectedBy: string,
    rows: CsvRow[],
  ): Promise<void> {
    let success = 0;
    let failed = 0;
    let notFound = 0;
    let processed = 0;
    let aborted: string | null = null;

    const queue = [...rows];
    const worker = async (): Promise<void> => {
      while (queue.length > 0 && !aborted) {
        const row = queue.shift();
        if (!row) break;
        try {
          const res = await this.verifications.run(
            orgId,
            { type, ...row, consent: true, consentCollectedBy },
            'dashboard',
            userId,
            null,
            batchId,
          );
          processed++;
          if (res.status === 'success') success++;
          else if (res.status === 'not_found') notFound++;
          else failed++;

          if (processed % 25 === 0 || queue.length === 0) {
            await this.prisma.client.verificationBatch.update({
              where: { id: batchId },
              data: { processedRows: processed, successCount: success, failedCount: failed, notFoundCount: notFound },
            });
          }
        } catch (err) {
          processed++;
          failed++;
          if (err instanceof InsufficientFundsException) {
            aborted = 'Ran out of wallet credit mid-batch';
            this.logger.warn(`batch ${batchId} aborted: insufficient funds`);
            break;
          }
          this.logger.warn(`batch ${batchId} row error: ${err instanceof Error ? err.message : err}`);
        }
      }
    };

    try {
      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
      await this.prisma.client.verificationBatch.update({
        where: { id: batchId },
        data: {
          status: aborted ? 'failed' : 'completed',
          processedRows: processed,
          successCount: success,
          failedCount: failed,
          notFoundCount: notFound,
          completedAt: new Date(),
          ...(aborted ? { errorMessage: aborted } : {}),
        },
      });
    } catch (err) {
      await this.prisma.client.verificationBatch
        .update({
          where: { id: batchId },
          data: {
            status: 'failed',
            completedAt: new Date(),
            errorMessage: err instanceof Error ? err.message : 'Batch processing error',
          },
        })
        .catch(() => undefined);
    }
  }

  async getBatch(orgId: string, batchId: string): Promise<BatchSummary> {
    const batch = await this.findOwned(orgId, batchId);
    return this.toSummary(batch);
  }

  async listBatches(orgId: string): Promise<BatchSummary[]> {
    const batches = await this.prisma.client.verificationBatch.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return batches.map((b) => this.toSummary(b));
  }

  /** Full per-row export for the results CSV download. */
  async getBatchResults(orgId: string, batchId: string) {
    await this.findOwned(orgId, batchId);
    const requests = await this.prisma.client.verificationRequest.findMany({
      where: { batchId },
      orderBy: { createdAt: 'asc' },
    });

    return requests.map((r) => ({
      subject: this.subjectOf(r.encryptedInput),
      status: r.status,
      name: this.nameOf(r.type as unknown as VerificationType, r.encryptedResult),
      detail: this.detailOf(r.type as unknown as VerificationType, r.encryptedResult),
      cost: Number(r.costMinor) / 100,
      latencyMs: r.latencyMs ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  private async findOwned(orgId: string, batchId: string) {
    const batch = await this.prisma.client.verificationBatch.findFirst({
      where: { id: batchId, organizationId: orgId },
    });
    if (!batch) throw new BadRequestException('Batch not found');
    return batch;
  }

  private toSummary(b: Omit<VerificationBatch, 'never'>): BatchSummary {
    return {
      id: b.id,
      type: b.type as unknown as VerificationType,
      status: b.status,
      totalRows: b.totalRows,
      processedRows: b.processedRows,
      successCount: b.successCount,
      failedCount: b.failedCount,
      notFoundCount: b.notFoundCount,
      errorMessage: b.errorMessage,
      createdAt: b.createdAt.toISOString(),
      completedAt: b.completedAt?.toISOString() ?? null,
    };
  }

  private subjectOf(encryptedInput: string): string {
    try {
      const input = JSON.parse(this.prisma.decrypt(encryptedInput)) as Record<string, string | number | null | undefined>;
      const subject = input.kraPin ?? input.phoneNumber ?? input.idNumber ?? input.alienId ?? input.passportNumber ?? input.vehicleRegNumber ?? input.dlNumber ?? input.businessRegNumber ?? input.meterNumber ?? (input.statementPages ? String(input.statementPages) : '—');
      return String(subject);
    } catch {
      return '—';
    }
  }

  private resultOf(encryptedResult: string | null): Record<string, unknown> | null {
    if (!encryptedResult) return null;
    try {
      return JSON.parse(this.prisma.decrypt(encryptedResult)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private nameOf(type: VerificationType, encryptedResult: string | null): string {
    const res = this.resultOf(encryptedResult);
    if (!res) return '';
    const r = res as Record<string, unknown>;
    switch (type) {
      case VerificationType.IPRS_STANDARD:
      case VerificationType.MATCH_ID_PHONE:
      case VerificationType.EMPLOYER_VERIFICATION:
      case VerificationType.FACE_ID_MATCH:
      case VerificationType.ALIEN_ID:
      case VerificationType.AML_PEP_SCREEN:
      case VerificationType.PASSPORT_CHECK:
      case VerificationType.SEARCH_NAME_BY_PHONE:
      case VerificationType.MOTOR_VEHICLE_OWNERSHIP:
      case VerificationType.DRIVERS_LICENSE_VERIFICATION:
      case VerificationType.BRS:
        return String(r.fullName ?? r.ownerName ?? r.taxpayerName ?? r.customerName ?? r.businessName ?? '');
      case VerificationType.KRA_PIN_VERIFICATION:
        return String(r.taxpayerName ?? '');
      case VerificationType.SEARCH_PHONES_BY_ID:
        return '';
      case VerificationType.BANK_ACCOUNT_VERIFICATION:
        return String(r.accountName ?? '');
      case VerificationType.KPLC_LOCATION_CHECKER:
        return String(r.customerName ?? '');
      case VerificationType.SIM_SWAP_CHECK:
        return '';
      case VerificationType.METROPOL_SCORE_ONLY:
      case VerificationType.METROPOL_STANDARD_REPORT:
      case VerificationType.METROPOL_FULL_REPORT:
      case VerificationType.CREDITINFO_SCORE_ONLY:
      case VerificationType.CREDITINFO_COMPREHENSIVE:
      case VerificationType.CREDITINFO_CRB_STATUS:
      case VerificationType.SPIN_SCORE_ONLY:
      case VerificationType.SCANNED_STATEMENT:
        return '';
      default:
        return '';
    }
  }

  private detailOf(type: VerificationType, encryptedResult: string | null): string {
    const res = this.resultOf(encryptedResult);
    if (!res) return '';
    const r = res as Record<string, unknown>;
    switch (type) {
      case VerificationType.IPRS_STANDARD:
        return String(r.dateOfBirth ?? '');
      case VerificationType.KRA_PIN_VERIFICATION:
        return String(r.status ?? '');
      case VerificationType.SEARCH_PHONES_BY_ID:
        return (r.registeredNumbers as string[] | undefined)?.join('; ') ?? '';
      case VerificationType.SIM_SWAP_CHECK:
        return `risk=${r.riskLevel ?? ''} lastSwap=${r.lastSwapDate ?? ''}`;
      case VerificationType.BANK_ACCOUNT_VERIFICATION:
        return String(r.accountStatus ?? '');
      case VerificationType.METROPOL_SCORE_ONLY:
      case VerificationType.CREDITINFO_SCORE_ONLY:
      case VerificationType.SPIN_SCORE_ONLY:
        return `score=${r.score ?? ''} band=${r.scoreBand ?? ''}`;
      case VerificationType.METROPOL_STANDARD_REPORT:
      case VerificationType.METROPOL_FULL_REPORT:
        return `score=${r.score ?? ''} accounts=${(r.accounts as unknown[] | undefined)?.length ?? 0}`;
      case VerificationType.CREDITINFO_COMPREHENSIVE:
        return `accounts=${(r.creditAccounts as unknown[] | undefined)?.length ?? 0}`;
      case VerificationType.CREDITINFO_CRB_STATUS:
        return String(r.status ?? '');
      case VerificationType.BRS:
        return String(r.status ?? '');
      case VerificationType.MOTOR_VEHICLE_OWNERSHIP:
        return `${r.make ?? ''} ${r.model ?? ''} (${r.year ?? ''})`;
      case VerificationType.DRIVERS_LICENSE_VERIFICATION:
        return String(r.status ?? '');
      case VerificationType.KPLC_LOCATION_CHECKER:
        return String(r.location ?? '');
      case VerificationType.SCANNED_STATEMENT:
        return `pages=${r.pagesProcessed ?? ''} txns=${(r.summary as Record<string, unknown> | undefined)?.transactionCount ?? ''}`;
      default:
        return '';
    }
  }
}