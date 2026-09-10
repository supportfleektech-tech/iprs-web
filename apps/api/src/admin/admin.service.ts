import { Injectable } from '@nestjs/common';
import { VerificationType, VERIFICATION_TYPES } from '@fleek/types';
import { PrismaService } from '../prisma/prisma.service';

export interface AnalyticsQuery {
  from?: string;
  to?: string;
  type?: string;
  status?: string;
}

export interface AnalyticsResult {
  dateRange: { from: string | null; to: string | null };
  totals: { verifications: number; cost: number; avgLatencyMs: number | null };
  statusCounts: Record<string, number>;
  productCounts: Record<string, number>;
  costByProduct: Record<string, number>;
}

const MAX_ANALYTICS_ROWS = 10000;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async analytics(organizationId: string | undefined, query: AnalyticsQuery): Promise<AnalyticsResult> {
    const where: Record<string, unknown> = {};
    if (organizationId) where.organizationId = organizationId;

    if (query.type && (VERIFICATION_TYPES as string[]).includes(query.type)) {
      where.type = query.type as VerificationType;
    }
    if (query.status) {
      const s = query.status.trim().toLowerCase();
      if (['pending', 'success', 'not_found', 'failed'].includes(s)) {
        where.status = s;
      }
    }

    let fromDate: Date | null = null;
    let toDate: Date | null = null;
    if (query.from) {
      const d = new Date(query.from);
      if (!Number.isNaN(d.getTime())) fromDate = d;
    }
    if (query.to) {
      const d = new Date(query.to);
      if (!Number.isNaN(d.getTime())) toDate = d;
    }
    if (fromDate || toDate) {
      const range: Record<string, Date> = {};
      if (fromDate) range.gte = fromDate;
      if (toDate) range.lte = toDate;
      where.createdAt = range;
    }

    const records = await this.prisma.client.verificationRequest.findMany({
      where,
      select: {
        type: true,
        status: true,
        costMinor: true,
        latencyMs: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_ANALYTICS_ROWS,
    });

    const verifications = records.length;
    let costMinorTotal = BigInt(0);
    const latencies: number[] = [];
    const statusCounts: Record<string, number> = {};
    const productCounts: Record<string, number> = {};
    const costByProduct: Record<string, number> = {};

    for (const r of records) {
      costMinorTotal += r.costMinor as bigint;
      if (typeof r.latencyMs === 'number' && Number.isFinite(r.latencyMs)) latencies.push(r.latencyMs);
      const s = String(r.status).toLowerCase();
      statusCounts[s] = (statusCounts[s] ?? 0) + 1;
      const t = String(r.type);
      productCounts[t] = (productCounts[t] ?? 0) + 1;
      const c = Number(r.costMinor) / 100;
      costByProduct[t] = (costByProduct[t] ?? 0) + c;
    }

    // Round cost by product to 2 decimals
    for (const k of Object.keys(costByProduct)) {
      costByProduct[k] = Math.round(costByProduct[k] * 100) / 100;
    }

    const avgLatencyMs = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;

    return {
      dateRange: {
        from: fromDate ? fromDate.toISOString() : null,
        to: toDate ? toDate.toISOString() : null,
      },
      totals: {
        verifications,
        cost: Math.round(Number(costMinorTotal) / 1) / 100,
        avgLatencyMs,
      },
      statusCounts,
      productCounts,
      costByProduct,
    };
  }
}
