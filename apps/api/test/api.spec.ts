import { describe, it, expect } from 'vitest';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RunVerificationDto } from '../src/verifications/dto';
import { InsufficientFundsException } from '../src/common/exceptions';

async function validateBody(body: object) {
  const dto = plainToInstance(RunVerificationDto, body);
  return validate(dto);
}

describe('RunVerificationDto', () => {
  it('accepts a valid IPRS request with consent', async () => {
    const errors = await validateBody({
      type: 'iprs_id',
      idNumber: '12345678',
      consent: true,
      consentCollectedBy: 'Acme Ltd',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects malformed ID numbers', async () => {
    const errors = await validateBody({
      type: 'iprs_id',
      idNumber: 'abc123',
      consent: true,
      consentCollectedBy: 'Acme Ltd',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects unknown check types', async () => {
    const errors = await validateBody({
      type: 'credit_score',
      consent: true,
      consentCollectedBy: 'Acme Ltd',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('requires consent fields (DPA compliance)', async () => {
    const errors = await validateBody({ type: 'sim_swap', phoneNumber: '0712345678' });
    expect(errors.length).toBeGreaterThanOrEqual(2); // consent + consentCollectedBy
  });

  it('ignores extra properties at DTO level (HTTP pipe strips/rejects them)', async () => {
    // forbidNonWhitelisted lives on the global ValidationPipe, not on validate().
    const errors = await validateBody({
      type: 'iprs_id',
      idNumber: '12345678',
      consent: true,
      consentCollectedBy: 'Acme',
      hackerField: 'nope',
    });
    expect(errors.filter((e) => e.property !== 'hackerField')).toHaveLength(0);
  });
});

describe('InsufficientFundsException', () => {
  it('maps to HTTP 402', () => {
    const exc = new InsufficientFundsException();
    expect(exc.getStatus()).toBe(402);
    expect(exc.getResponse()).toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
  });
});
