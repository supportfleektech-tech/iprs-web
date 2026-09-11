import { Injectable, NotFoundException } from '@nestjs/common';
import type { VerificationRequest } from '@prisma/client';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';
import { VerificationType, VERIFICATION_TYPES } from '@fleek/types';

interface ExportOptions {
  format: 'csv' | 'xlsx' | 'pdf';
  type?: VerificationType;
  from?: string;
  to?: string;
  status?: string;
  search?: string;
  organizationId: string;
}

interface BatchExportOptions {
  format: 'csv' | 'xlsx' | 'pdf';
  batchId: string;
  organizationId: string;
}

interface WalletExportOptions {
  format: 'csv' | 'xlsx' | 'pdf';
  organizationId: string;
  from?: string;
  to?: string;
}

interface CertificateOptions {
  verificationId: string;
  organizationId: string;
}

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportVerifications(
    options: ExportOptions,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const { format, type, from, to, status, search, organizationId } = options;

    const where: Record<string, unknown> = { organizationId };
    if (type) where.type = type;
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Record<string, Date>).gte = new Date(from);
      if (to) (where.createdAt as Record<string, Date>).lte = new Date(to);
    }
    const trimmedSearch = search?.trim();
    if (trimmedSearch) {
      const lower = trimmedSearch.toLowerCase();
      const matchingTypes = VERIFICATION_TYPES.filter((t) => t.toLowerCase().includes(lower));
      const statusValues = ['pending', 'success', 'not_found', 'failed'] as const;
      const matchingStatuses = statusValues.filter((s) => s.includes(lower));
      const or: Record<string, unknown>[] = [
        { id: { contains: trimmedSearch, mode: 'insensitive' } },
        { source: { contains: trimmedSearch, mode: 'insensitive' } },
      ];
      if (matchingTypes.length) or.push({ type: { in: matchingTypes } });
      if (matchingStatuses.length) or.push({ status: { in: matchingStatuses } });
      where.OR = or;
    }

    const requests = await this.prisma.client.verificationRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        status: true,
        source: true,
        costMinor: true,
        latencyMs: true,
        createdAt: true,
        encryptedInput: true,
        encryptedResult: true,
        isBackup: true,
      },
    });

    const rows = requests.map((r) => {
      const input = JSON.parse(this.prisma.decrypt(r.encryptedInput));
      const result = r.encryptedResult ? JSON.parse(this.prisma.decrypt(r.encryptedResult)) : null;
      return {
        id: r.id,
        type: r.type,
        status: r.status,
        source: r.source,
        cost_kes: Number(r.costMinor) / 100,
        latency_ms: r.latencyMs ?? '',
        created_at: r.createdAt.toISOString(),
        subject: this.getSubject(input),
        result: result ? JSON.stringify(result) : '',
        is_backup: r.isBackup,
      };
    });

    return await this.generateExport(rows, format, `verifications-${this.getDateStamp()}`);
  }

  async exportBatch(
    options: BatchExportOptions,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const { format, batchId, organizationId } = options;

    const batch = await this.prisma.client.verificationBatch.findFirst({
      where: { id: batchId, organizationId },
    });
    if (!batch) throw new NotFoundException('Batch not found');

    const requests = await this.prisma.client.verificationRequest.findMany({
      where: { batchId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        type: true,
        status: true,
        source: true,
        costMinor: true,
        latencyMs: true,
        createdAt: true,
        encryptedInput: true,
        encryptedResult: true,
        isBackup: true,
      },
    });

    const rows = requests.map((r) => {
      const input = JSON.parse(this.prisma.decrypt(r.encryptedInput));
      const result = r.encryptedResult ? JSON.parse(this.prisma.decrypt(r.encryptedResult)) : null;
      return {
        subject: this.getSubject(input),
        status: r.status,
        name: this.getResultName(r.type as VerificationType, result),
        detail: this.getResultDetail(r.type as VerificationType, result),
        cost_kes: Number(r.costMinor) / 100,
        latency_ms: r.latencyMs ?? '',
        created_at: r.createdAt.toISOString(),
        is_backup: r.isBackup,
      };
    });

    return await this.generateExport(
      rows,
      format,
      `batch-${batchId.slice(0, 8)}-results-${this.getDateStamp()}`,
    );
  }

  async exportWalletStatement(
    options: WalletExportOptions,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const { format, organizationId, from, to } = options;

    const where: Record<string, unknown> = { wallet: { organizationId } };
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Record<string, Date>).gte = new Date(from);
      if (to) (where.createdAt as Record<string, Date>).lte = new Date(to);
    }

    const transactions = await this.prisma.client.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        amountMinor: true,
        balanceAfter: true,
        description: true,
        createdAt: true,
        verificationId: true,
      },
    });

    const rows = transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount_kes:
        t.type === 'topup' ? `+${Number(t.amountMinor) / 100}` : `-${Number(t.amountMinor) / 100}`,
      balance_after_kes: Number(t.balanceAfter) / 100,
      description: t.description ?? '',
      created_at: t.createdAt.toISOString(),
    }));

    return await this.generateExport(rows, format, `wallet-statement-${this.getDateStamp()}`);
  }

  async generateVerificationCertificate(
    options: CertificateOptions,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const { verificationId, organizationId } = options;

    const request = await this.prisma.client.verificationRequest.findFirst({
      where: { id: verificationId, organizationId },
      select: {
        id: true,
        type: true,
        status: true,
        source: true,
        costMinor: true,
        latencyMs: true,
        createdAt: true,
        encryptedInput: true,
        encryptedResult: true,
        consent: true,
        consentCollectedBy: true,
        cbConsent: true,
        isBackup: true,
        organization: { select: { name: true } },
      },
    });

    if (!request) throw new NotFoundException('Verification not found');

    const input = JSON.parse(this.prisma.decrypt(request.encryptedInput));
    const result = request.encryptedResult
      ? JSON.parse(this.prisma.decrypt(request.encryptedResult))
      : null;

    const certificate = this.generateCertificatePDF(request, input, result);
    const filename = `certificate-${verificationId.slice(0, 8)}-${this.getDateStamp()}.pdf`;

    return { buffer: certificate, filename, contentType: 'application/pdf' };
  }

  private getSubject(input: Record<string, unknown>): string {
    const candidates = [
      input.kraPin,
      input.phoneNumber,
      input.idNumber,
      input.alienId,
      input.passportNumber,
      input.vehicleRegNumber,
      input.dlNumber,
      input.businessRegNumber,
      input.meterNumber,
      input.statementPages,
    ];
    const found = candidates.find((v) => v !== null && v !== undefined);
    return found !== undefined ? String(found) : '—';
  }

  private getResultName(type: VerificationType, result: Record<string, unknown> | null): string {
    if (!result) return '';
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
        return String(
          result.fullName ??
            result.ownerName ??
            result.taxpayerName ??
            result.customerName ??
            result.businessName ??
            '',
        );
      case VerificationType.KRA_PIN_VERIFICATION:
      case VerificationType.BANK_ACCOUNT_VERIFICATION:
        return String(result.taxpayerName ?? result.accountName ?? '');
      case VerificationType.KPLC_LOCATION_CHECKER:
        return String(result.customerName ?? '');
      default:
        return '';
    }
  }

  private getResultDetail(type: VerificationType, result: Record<string, unknown> | null): string {
    if (!result) return '';
    const r = result;
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

  private getDateStamp(): string {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
  }

  private async generateExport(
    rows: Record<string, unknown>[],
    format: 'csv' | 'xlsx' | 'pdf',
    baseFilename: string,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    switch (format) {
      case 'csv':
        return this.generateCSV(rows, baseFilename);
      case 'xlsx':
        return this.generateXLSX(rows, baseFilename);
      case 'pdf':
        return this.generatePDF(rows, baseFilename);
    }
  }

  private generateCSV(
    rows: Record<string, unknown>[],
    baseFilename: string,
  ): { buffer: Buffer; filename: string; contentType: string } {
    if (rows.length === 0) {
      return { buffer: Buffer.from(''), filename: `${baseFilename}.csv`, contentType: 'text/csv' };
    }

    const headers = Object.keys(rows[0]);
    const csvRows = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const val = row[h] ?? '';
            const str = String(val).replace(/"/g, '""');
            return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
          })
          .join(','),
      ),
    ];
    const csv = csvRows.join('\n');
    return {
      buffer: Buffer.from(csv, 'utf-8'),
      filename: `${baseFilename}.csv`,
      contentType: 'text/csv',
    };
  }

  private async generateXLSX(
    rows: Record<string, unknown>[],
    baseFilename: string,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Export');

      if (rows.length > 0) {
        const headers = Object.keys(rows[0]);
        worksheet.columns = headers.map((h) => ({
          header: h,
          key: h,
          width: Math.max(h.length + 5, 20),
        }));
        worksheet.addRows(rows);
        worksheet.getRow(1).font = { bold: true };
      }

      const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
      return {
        buffer: Buffer.from(buffer),
        filename: `${baseFilename}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    } catch (error) {
      console.error('XLSX generation failed, falling back to CSV:', error);
      return this.generateCSV(rows, baseFilename);
    }
  }

  private generatePDF(
    rows: Record<string, unknown>[],
    baseFilename: string,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));

      doc.fontSize(18).text('Fleek IPRS — Export Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.text(`Records: ${rows.length}`, { align: 'center' });
      doc.moveDown(2);

      if (rows.length > 0) {
        const headers = Object.keys(rows[0]);
        const colWidth = (doc.page.width - 60) / headers.length;

        doc.font('Helvetica-Bold').fontSize(8);
        headers.forEach((h, i) => {
          doc.text(h, 30 + i * colWidth, doc.y, { width: colWidth - 5, align: 'left' });
        });
        doc.moveDown(0.5);

        doc.font('Helvetica').fontSize(7);
        rows.slice(0, 500).forEach((row) => {
          headers.forEach((h, i) => {
            const val = String(row[h] ?? '').slice(0, 50);
            doc.text(val, 30 + i * colWidth, doc.y, { width: colWidth - 5, align: 'left' });
          });
          doc.moveDown(0.3);
          if (doc.y > doc.page.height - 50) {
            doc.addPage();
          }
        });
      }

      doc.end();

      return new Promise((resolve) => {
        doc.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({ buffer, filename: `${baseFilename}.pdf`, contentType: 'application/pdf' });
        });
      });
    } catch (error) {
      console.error('PDF generation failed, falling back to CSV:', error);
      return Promise.resolve(this.generateCSV(rows, baseFilename));
    }
  }

  private generateCertificatePDF(
    request: Pick<
      VerificationRequest,
      | 'id'
      | 'createdAt'
      | 'type'
      | 'status'
      | 'source'
      | 'encryptedInput'
      | 'encryptedResult'
      | 'costMinor'
      | 'consent'
      | 'consentCollectedBy'
      | 'cbConsent'
      | 'isBackup'
    >,
    input: Record<string, unknown>,
    result: Record<string, unknown> | null,
  ): Buffer {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    doc.fontSize(24).text('FLEEK IPRS', { align: 'center' });
    doc.fontSize(14).text('Verification Certificate', { align: 'center' });
    doc.moveDown();

    doc.fontSize(10).text(`Certificate ID: ${request.id}`, { align: 'center' });
    doc
      .fontSize(10)
      .text(`Issued: ${new Date(request.createdAt).toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(14).text('Verification Details', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`Type: ${this.getTypeLabel(request.type as VerificationType)}`);
    doc.text(`Status: ${request.status.toUpperCase()}`);
    doc.text(`Source: ${request.source}`);
    doc.text(`Cost: KES ${Number(request.costMinor) / 100}`);
    doc.text(
      `Consent: ${request.consent ? 'Yes' : 'No'} (Collected by: ${request.consentCollectedBy})`,
    );
    if (request.cbConsent) doc.text('Credit Bureau Consent: Provided');
    if (request.isBackup) doc.text('Note: Verified via backup provider');
    doc.moveDown();

    doc.fontSize(14).text('Subject Information', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    Object.entries(input).forEach(([k, v]) => {
      if (v !== null && v !== undefined) {
        doc.text(`${this.formatKey(k)}: ${v}`);
      }
    });
    doc.moveDown();

    if (result) {
      doc.fontSize(14).text('Result', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11);
      Object.entries(result).forEach(([k, v]) => {
        if (v !== null && v !== undefined) {
          const displayValue = typeof v === 'object' ? JSON.stringify(v) : v;
          doc.text(`${this.formatKey(k)}: ${displayValue}`);
        }
      });
    }

    doc.moveDown(3);
    doc
      .fontSize(9)
      .text('This certificate confirms the verification was performed via Fleek IPRS.', {
        align: 'center',
      });
    doc.text(
      'Results are encrypted at rest per Kenya DPA 2019. Verify authenticity at api.fleekiprs.co.ke',
      { align: 'center' },
    );

    doc.end();

    return Buffer.concat(chunks);
  }

  private getTypeLabel(type: VerificationType): string {
    const labels: Record<string, string> = {
      iprs_standard: 'IPRS Standard Verification',
      match_id_phone: 'Match ID & Phone Number',
      employer_verification: 'Employer Verification',
      face_id_match: 'Face ID Match',
      bank_account_verification: 'Bank Account Verification',
      alien_id: 'Alien ID Verification',
      aml_pep_screen: 'AML & PEP Screen',
      passport_check: 'Passport Check',
      sim_swap_check: 'SIM Swap Check',
      kplc_location_checker: 'KPLC Location Checker',
      kra_pin_verification: 'KRA PIN Verification',
      search_name_by_phone: 'Search Name by Phone Number',
      search_phones_by_id: 'Search Phone Numbers by ID',
      motor_vehicle_ownership: 'Motor Vehicle Ownership',
      drivers_license_verification: "Driver's License Verification",
      metropol_score_only: 'Metropol Score Only',
      metropol_standard_report: 'Metropol Standard Report',
      metropol_full_report: 'Metropol Full Report',
      creditinfo_score_only: 'CreditInfo Score Only',
      creditinfo_comprehensive: 'CreditInfo Comprehensive Report',
      creditinfo_crb_status: 'CreditInfo CRB Status',
      brs: 'BRS (Business Registration)',
      spin_score_only: 'SPIN Score Only',
      scanned_statement: 'Scanned Statement Analysis',
    };
    return labels[type] ?? type;
  }

  private formatKey(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
  }
}
