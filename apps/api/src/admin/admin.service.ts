import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { VERIFICATION_TYPES } from '@fleek/types';
import { PrismaService } from '../prisma/prisma.service';

export interface AnalyticsQuery {
  from?: string;
  to?: string;
  type?: string;
  status?: string;
  search?: string;
}

export interface AnalyticsResult {
  dateRange: { from: string | null; to: string | null };
  totals: { verifications: number; cost: number; avgLatencyMs: number | null };
  statusCounts: Record<string, number>;
  productCounts: Record<string, number>;
  costByProduct: Record<string, number>;
  truncated: boolean;
}

const MAX_ANALYTICS_ROWS = 10000;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async analytics(organizationId: string | undefined, query: AnalyticsQuery): Promise<AnalyticsResult> {
    const where: Prisma.VerificationRequestWhereInput = {};
    if (organizationId) where.organizationId = organizationId;

    if (query.type && (VERIFICATION_TYPES as string[]).includes(query.type)) {
      (where as Record<string, unknown>).type = query.type;
    }
    if (query.status) {
      const s = query.status.trim().toLowerCase();
      if (['pending', 'success', 'not_found', 'failed'].includes(s)) {
        (where as Record<string, unknown>).status = s;
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
    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('from must be <= to');
    }
    if (fromDate || toDate) {
      const range: Prisma.DateTimeFilter = {};
      if (fromDate) range.gte = fromDate;
      if (toDate) range.lte = toDate;
      where.createdAt = range;
    }

    const search = query.search?.trim();
    if (search) {
      const lower = search.toLowerCase();
      const matchingTypes = VERIFICATION_TYPES.filter((t) => t.toLowerCase().includes(lower));
      const statusValues = ['pending', 'success', 'not_found', 'failed'] as const;
      const matchingStatuses = statusValues.filter((s) => s.includes(lower));
      const or: Prisma.VerificationRequestWhereInput[] = [
        { id: { contains: search, mode: 'insensitive' } },
        { source: { contains: search, mode: 'insensitive' } },
      ];
      if (matchingTypes.length) or.push({ type: { in: matchingTypes as unknown as never } });
      if (matchingStatuses.length) or.push({ status: { in: matchingStatuses as unknown as never } });
      where.OR = or;
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
    const truncated = verifications === MAX_ANALYTICS_ROWS;
    let costMinorTotal = BigInt(0);
    const latencies: number[] = [];
    const statusCounts: Record<string, number> = {};
    const productCounts: Record<string, number> = {};
    const costByProductMinor = new Map<string, bigint>();

    for (const r of records) {
      costMinorTotal += r.costMinor as bigint;
      if (typeof r.latencyMs === 'number' && Number.isFinite(r.latencyMs)) latencies.push(r.latencyMs);
      const s = String(r.status).toLowerCase();
      statusCounts[s] = (statusCounts[s] ?? 0) + 1;
      const t = String(r.type);
      productCounts[t] = (productCounts[t] ?? 0) + 1;
      costByProductMinor.set(t, (costByProductMinor.get(t) ?? BigInt(0)) + (r.costMinor as bigint));
    }

    const costByProduct: Record<string, number> = {};
    for (const [k, v] of costByProductMinor.entries()) {
      costByProduct[k] = Math.round(Number(v)) / 100;
    }

    const avgLatencyMs = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;

    return {
      dateRange: {
        from: fromDate ? fromDate.toISOString() : null,
        to: toDate ? toDate.toISOString() : null,
      },
      totals: {
        verifications,
        cost: Math.round(Number(costMinorTotal)) / 100,
        avgLatencyMs,
      },
      statusCounts,
      productCounts,
      costByProduct,
      truncated,
    };
  }
}
