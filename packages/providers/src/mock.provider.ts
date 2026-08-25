import { VerificationType, type IprsResult, type KraResult, type PhoneResult, type SimSwapResult } from '@fleek/types';
import { ProviderError, assertSupported, type KraInput, type PhoneInput, type VerificationProvider } from './provider';

const FIRST_NAMES = ['John', 'Jane', 'Peter', 'Mary', 'Samuel', 'Grace', 'Dennis', 'Faith', 'Brian', 'Lucy'];
const SURNAMES = ['Kamau', 'Wanjiku', 'Otieno', 'Achieng', 'Mutiso', 'Njoroge', 'Chebet', 'Odhiambo', 'Kiptoo', 'Mwende'];
const CITIES = ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Machakos'];

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: string): T {
  return arr[hash(seed) % arr.length] as T;
}

/**
 * Deterministic mock provider: same input always returns the same
 * realistic-looking data. Doubles as the sandbox provider and test fixture.
 */
export class MockProvider implements VerificationProvider {
  readonly name = 'mock';
  readonly sandbox = true;
  readonly supported = Object.values(VerificationType);

  async iprsIdLookup(idNumber: string): Promise<IprsResult> {
    assertSupported(VerificationType.IPRS_ID, this.supported);
    if (!/^\d{7,9}$/.test(idNumber)) {
      throw new ProviderError('INVALID_INPUT', 'ID number must be 7-9 digits');
    }
    const found = hash(idNumber) % 25 !== 0; // ~4% not found
    if (!found) throw new ProviderError('NOT_FOUND', `No IPRS record for ID ${idNumber}`);

    const first = pick(FIRST_NAMES, idNumber);
    const surname = pick(SURNAMES, `s${idNumber}`);
    const other = pick(FIRST_NAMES, `o${idNumber}`);
    const birthYear = 1960 + (hash(`y${idNumber}`) % 45);
    const birthMonth = String(1 + (hash(`m${idNumber}`) % 12)).padStart(2, '0');
    const birthDay = String(1 + (hash(`d${idNumber}`) % 28)).padStart(2, '0');

    return {
      idNumber,
      surname,
      firstName: first,
      otherName: other,
      fullName: `${surname} ${first} ${other}`,
      gender: hash(`g${idNumber}`) % 2 === 0 ? 'MALE' : 'FEMALE',
      dateOfBirth: `${birthYear}-${birthMonth}-${birthDay}`,
      citizenship: 'Kenyan',
      serialNumber: `${hash(`sn${idNumber}`)}`.slice(0, 8).padStart(8, '0'),
      placeOfBirth: pick(CITIES, `pb${idNumber}`),
      placeOfLive: pick(CITIES, `pl${idNumber}`),
      photoBase64: null as unknown as string,
      aliveStatus: hash(`a${idNumber}`) % 50 !== 0,
    };
  }

  async kraPinCheck(input: KraInput): Promise<KraResult> {
    assertSupported(VerificationType.KRA_PIN, this.supported);
    const pin = input.kraPin ?? (input.idNumber ? `A${input.idNumber.slice(0, 8)}Z` : undefined);
    if (!pin || !/^[AP]\d{9}[A-Z]$/.test(pin)) {
      throw new ProviderError('INVALID_INPUT', 'Invalid KRA PIN format (expected A#########Z)');
    }
    const statusRoll = hash(pin) % 10;
    return {
      idNumber: input.idNumber,
      kraPin: pin,
      taxpayerName: `${pick(SURNAMES, pin)} ${pick(FIRST_NAMES, `k${pin}`)}`,
      status: statusRoll < 8 ? 'active' : statusRoll === 8 ? 'inactive' : 'deregistered',
      taxObligation: 'INCOME TAX - RESIDENT INDIVIDUAL',
    };
  }

  async phoneOwnership(input: PhoneInput): Promise<PhoneResult> {
    assertSupported(VerificationType.PHONE_OWNERSHIP, this.supported);
    const phone = input.phoneNumber;
    const seed = phone ?? input.idNumber;
    if (!seed) throw new ProviderError('INVALID_INPUT', 'Provide phoneNumber or idNumber');
    if (phone && !/^(\+?254|0)7\d{8}$/.test(phone.replace(/\s/g, ''))) {
      throw new ProviderError('INVALID_INPUT', 'Phone must be a valid Kenyan mobile number');
    }
    const normalized = phone?.replace(/^(\+?254|0)/, '+254') ?? `+2547${hash(seed) % 100000000}`;
    const count = 1 + (hash(`c${seed}`) % 3);
    const numbers = Array.from({ length: count }, (_, i) =>
      i === 0 ? normalized : `${normalized.slice(0, 6)}${(hash(`n${seed}${i}`) % 10000000) + 7000000}`,
    );
    return {
      ownerName: `${pick(FIRST_NAMES, seed)} ${pick(SURNAMES, `p${seed}`)}`,
      idNumber: input.idNumber ?? `${8000000 + (hash(`i${seed}`) % 9999999)}`,
      registeredNumbers: numbers,
      mpesaRegistered: hash(`m${seed}`) % 8 !== 0,
    };
  }

  async simSwapCheck(phoneNumber: string): Promise<SimSwapResult> {
    assertSupported(VerificationType.SIM_SWAP, this.supported);
    if (!/^(\+?254|0)7\d{8}$/.test(phoneNumber.replace(/\s/g, ''))) {
      throw new ProviderError('INVALID_INPUT', 'Phone must be a valid Kenyan mobile number');
    }
    const days = hash(phoneNumber) % 400;
    return {
      phoneNumber,
      lastSwapDate:
        days > 2
          ? new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
          : new Date(Date.now() - (days + 3) * 86_400_000).toISOString().slice(0, 10),
      daysSinceSwap: days,
      riskLevel: days < 14 ? 'high' : days < 90 ? 'medium' : 'low',
    };
  }
}
