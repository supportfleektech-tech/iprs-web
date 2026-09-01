import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportService } from '../src/verifications/exports/export.service';

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(() => {
    service = new ExportService({
      client: {
        verificationRequest: {
          findMany: vi.fn(),
        },
        verificationBatch: {
          findFirst: vi.fn(),
        },
        transaction: {
          findMany: vi.fn(),
        },
        $transaction: vi.fn(),
      },
      decrypt: vi.fn((payload) => {
        if (payload === 'encrypted-input') return JSON.stringify({ idNumber: '12345678' });
        if (payload === 'encrypted-result') return JSON.stringify({ fullName: 'John Doe' });
        return '{}';
      }),
    } as any);
  });

  describe('generateExport', () => {
    it('should generate CSV export', async () => {
      (service as any).prisma.client.verificationRequest.findMany.mockResolvedValue([
        { id: '1', type: 'iprs_standard', status: 'success', costMinor: 5000n, latencyMs: 100, createdAt: new Date(), encryptedInput: 'encrypted-input', encryptedResult: 'encrypted-result', isBackup: false, source: 'dashboard' },
        { id: '2', type: 'kra_pin', status: 'not_found', costMinor: 0n, latencyMs: 50, createdAt: new Date(), encryptedInput: 'encrypted-input', encryptedResult: null, isBackup: false, source: 'api' },
      ]);

      (service as any).prisma.decrypt.mockImplementation((val: string) => {
        if (val === 'encrypted-input') return '{"idNumber":"12345678"}';
        if (val === 'encrypted-result') return '{"fullName":"John Doe"}';
        return '{}';
      });

      const result = await service.exportVerifications({
        format: 'csv',
        organizationId: 'org-1',
      });

      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toMatch(/^verifications-\d{8}\.csv$/);
      const csv = result.buffer.toString('utf-8');
      expect(csv).toContain('id,type,status,source,cost_kes,latency_ms,created_at,subject,result,is_backup');
      expect(csv).toContain('1,iprs_standard,success,dashboard,50');
    });

    it.skip('should generate XLSX export (requires exceljs)', async () => {
      // Skipped because exceljs is not installed in test environment
    });

    it('should handle empty rows', async () => {
      (service as any).prisma.client.verificationRequest.findMany.mockResolvedValue([]);

      const result = await service.exportVerifications({
        format: 'csv',
        organizationId: 'org-1',
      });

      expect(result.buffer.toString()).toBe('');
    });
  });

  describe('getSubject', () => {
    it('should extract subject from various input types', () => {
      const service = new ExportService({} as any);
      expect((service as any).getSubject({ kraPin: 'A123456789Z' })).toBe('A123456789Z');
      expect((service as any).getSubject({ phoneNumber: '0712345678' })).toBe('0712345678');
      expect((service as any).getSubject({ idNumber: '12345678' })).toBe('12345678');
      expect((service as any).getSubject({ alienId: 'ALN123' })).toBe('ALN123');
      expect((service as any).getSubject({ passportNumber: 'P12345' })).toBe('P12345');
      expect((service as any).getSubject({})).toBe('—');
    });
  });

  describe('getResultName', () => {
    it('should extract name from result', () => {
      const service = new ExportService({} as any);
      expect((service as any).getResultName('iprs_standard', { fullName: 'John Doe' })).toBe('John Doe');
      expect((service as any).getResultName('kra_pin_verification', { taxpayerName: 'Jane Smith' })).toBe('Jane Smith');
      expect((service as any).getResultName('bank_account_verification', { accountName: 'John Account' })).toBe('John Account');
    });
  });
});