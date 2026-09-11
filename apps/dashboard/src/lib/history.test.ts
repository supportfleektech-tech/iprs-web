import { describe, it, expect } from 'vitest';
import {
  buildHistoryQuery,
  buildHistoryQueryString,
  buildVerificationsExportUrl,
  buildCertificateUrl,
  escapeCsvCell,
  toCsv,
  classifyHistoryStatus,
  getHistoryStatusLabel,
  summarizeHistoryMetrics,
} from './exports';

describe('buildHistoryQuery', () => {
  it('returns empty for no filters', () => {
    expect(buildHistoryQuery({})).toBe('');
    expect(buildHistoryQueryString({})).toBe('');
  });

  it('builds type/status/from/to/search/limit/offset params', () => {
    const qs = buildHistoryQuery({
      type: 'iprs_standard',
      status: 'success',
      from: '2026-01-01',
      to: '2026-01-31',
      search: '07123',
      limit: 20,
      offset: 40,
    });
    const p = new URLSearchParams(qs);
    expect(p.get('type')).toBe('iprs_standard');
    expect(p.get('status')).toBe('success');
    expect(p.get('from')).toBe('2026-01-01');
    expect(p.get('to')).toBe('2026-01-31');
    expect(p.get('search')).toBe('07123');
    expect(p.get('limit')).toBe('20');
    expect(p.get('offset')).toBe('40');
  });

  it('omits empty strings and trims', () => {
    const qs = buildHistoryQuery({ type: '  ', status: '', search: '  hello  ' });
    const p = new URLSearchParams(qs);
    expect(p.has('type')).toBe(false);
    expect(p.has('status')).toBe(false);
    expect(p.get('search')).toBe('hello');
  });

  it('supports startDate/endDate aliases', () => {
    const qs = buildHistoryQuery({
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    } as unknown as Record<string, string>);
    const p = new URLSearchParams(qs);
    expect(p.get('from')).toBe('2026-02-01');
    expect(p.get('to')).toBe('2026-02-28');
  });

  it('handles limit=0 and offset=0', () => {
    const qs = buildHistoryQuery({ limit: 0, offset: 0 });
    const p = new URLSearchParams(qs);
    expect(p.get('limit')).toBe('0');
    expect(p.get('offset')).toBe('0');
  });

  it('buildHistoryQueryString adds leading ?', () => {
    expect(buildHistoryQueryString({ type: 'kra_pin_verification' })).toBe(
      '?type=kra_pin_verification',
    );
  });
});

describe('buildVerificationsExportUrl', () => {
  it('builds export URL with format and filters', () => {
    const url = buildVerificationsExportUrl(
      { type: 'iprs_standard', status: 'success', from: '2026-01-01' },
      'csv',
    );
    const p = new URLSearchParams(url.split('?')[1]);
    expect(url.startsWith('/exports/verifications?')).toBe(true);
    expect(p.get('format')).toBe('csv');
    expect(p.get('type')).toBe('iprs_standard');
    expect(p.get('status')).toBe('success');
    expect(p.get('from')).toBe('2026-01-01');
  });

  it('supports xlsx and pdf formats', () => {
    expect(buildVerificationsExportUrl({}, 'xlsx')).toContain('format=xlsx');
    expect(buildVerificationsExportUrl({}, 'pdf')).toContain('format=pdf');
  });
});

describe('buildCertificateUrl', () => {
  it('encodes id', () => {
    expect(buildCertificateUrl('abc-123')).toBe('/exports/verifications/abc-123/certificate');
    expect(buildCertificateUrl('id/with/slash')).toContain(encodeURIComponent('id/with/slash'));
  });
});

describe('escapeCsvCell', () => {
  it('returns empty for null/undefined', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
    expect(escapeCsvCell('')).toBe('');
  });

  it('does not quote simple values', () => {
    expect(escapeCsvCell('hello')).toBe('hello');
    expect(escapeCsvCell(123)).toBe('123');
  });

  it('quotes fields containing comma', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
  });

  it('quotes and escapes double quotes', () => {
    expect(escapeCsvCell('a"b')).toBe('"a""b"');
    expect(escapeCsvCell('"hello"')).toBe('"""hello"""');
  });

  it('quotes fields containing newline', () => {
    expect(escapeCsvCell('a\nb')).toBe('"a\nb"');
    expect(escapeCsvCell('a\rb')).toBe('"a\rb"');
  });
});

describe('toCsv', () => {
  it('joins header and rows with escaping', () => {
    const csv = toCsv(
      ['id', 'subject', 'cost'],
      [
        ['1', '12345678', 30],
        ['2', 'a,b', 20],
        ['3', 'a"b', null],
      ],
    );
    const lines = csv.split('\n');
    expect(lines[0]).toBe('id,subject,cost');
    expect(lines[1]).toBe('1,12345678,30');
    expect(lines[2]).toBe('2,"a,b",20');
    expect(lines[3]).toBe('3,"a""b",');
  });

  it('handles empty rows', () => {
    expect(toCsv(['a', 'b'], [])).toBe('a,b');
  });
});

describe('classifyHistoryStatus', () => {
  it('maps success to green', () => {
    expect(classifyHistoryStatus('success')).toBe('green');
    expect(classifyHistoryStatus('SUCCESS')).toBe('green');
  });
  it('maps failed to red', () => {
    expect(classifyHistoryStatus('failed')).toBe('red');
    expect(classifyHistoryStatus('error')).toBe('red');
  });
  it('maps not_found to amber', () => {
    expect(classifyHistoryStatus('not_found')).toBe('amber');
  });
  it('maps pending/processing to amber', () => {
    expect(classifyHistoryStatus('pending')).toBe('amber');
    expect(classifyHistoryStatus('processing')).toBe('amber');
  });
  it('maps low/info to blue', () => {
    expect(classifyHistoryStatus('low')).toBe('blue');
  });
  it('returns slate for unknown', () => {
    expect(classifyHistoryStatus('unknown_xyz')).toBe('slate');
    expect(classifyHistoryStatus('')).toBe('slate');
  });
});

describe('getHistoryStatusLabel', () => {
  it('humanises known', () => {
    expect(getHistoryStatusLabel('success')).toBe('Success');
    expect(getHistoryStatusLabel('not_found')).toBe('Not found');
    expect(getHistoryStatusLabel('pending')).toBe('Pending');
    expect(getHistoryStatusLabel('processing')).toBe('Processing');
    expect(getHistoryStatusLabel('failed')).toBe('Failed');
  });
  it('capitalizes unknown with underscores', () => {
    expect(getHistoryStatusLabel('custom_status')).toBe('Custom status');
  });
});

describe('summarizeHistoryMetrics', () => {
  it('computes totals', () => {
    const items = [
      { cost: 30, latencyMs: 100, status: 'success' },
      { cost: 20, latencyMs: 200, status: 'failed' },
      { cost: 0, latencyMs: null, status: 'pending' },
    ];
    const m = summarizeHistoryMetrics(items);
    expect(m.totalCost).toBe(50);
    expect(m.avgLatencyMs).toBe(150);
    expect(m.total).toBe(3);
    expect(m.statusCounts).toEqual({ success: 1, failed: 1, pending: 1 });
  });
  it('handles empty', () => {
    const m = summarizeHistoryMetrics([]);
    expect(m.totalCost).toBe(0);
    expect(m.avgLatencyMs).toBeNull();
    expect(m.statusCounts).toEqual({});
    expect(m.total).toBe(0);
  });
  it('ignores non-finite costs and latencies', () => {
    const m = summarizeHistoryMetrics([
      { cost: NaN, latencyMs: NaN as unknown as number, status: 'success' },
      { cost: 10, latencyMs: 50, status: 'success' },
    ]);
    expect(m.totalCost).toBe(10);
    expect(m.avgLatencyMs).toBe(50);
  });
});
