import { VerificationType } from '@fleek/types';
import type {
  IprsStandardResult,
  MatchIdPhoneResult,
  EmployerVerificationResult,
  FaceIdMatchResult,
  BankAccountVerificationResult,
  AlienIdResult,
  AmlPepScreenResult,
  PassportCheckResult,
  SimSwapCheckResult,
  KplcLocationCheckerResult,
  KraPinVerificationResult,
  SearchNameByPhoneResult,
  SearchPhonesByIdResult,
  MotorVehicleOwnershipResult,
  DriversLicenseVerificationResult,
  MetropolScoreOnlyResult,
  MetropolStandardReportResult,
  MetropolFullReportResult,
  CreditInfoScoreOnlyResult,
  CreditInfoComprehensiveResult,
  CreditInfoCrbStatusResult,
  BrsResult,
  SpinScoreOnlyResult,
  ScannedStatementResult,
} from '@fleek/types';
import {
  ProviderError,
  assertSupported,
  type KraInput,
  type FaceIdInput,
  type BankAccountInput,
  type AlienIdInput,
  type PassportInput,
  type EmployerInput,
  type MeterInput,
  type VehicleInput,
  type DriversLicenseInput,
  type BusinessRegInput,
  type ScannedStatementInput,
  type VerificationProvider,
} from './provider';

const FIRST_NAMES = [
  'John',
  'Jane',
  'Peter',
  'Mary',
  'Samuel',
  'Grace',
  'Dennis',
  'Faith',
  'Brian',
  'Lucy',
];
const SURNAMES = [
  'Kamau',
  'Wanjiku',
  'Otieno',
  'Achieng',
  'Mutiso',
  'Njoroge',
  'Chebet',
  'Odhiambo',
  'Kiptoo',
  'Mwende',
];
const CITIES = ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Machakos'];
const BANKS = [
  'KCB',
  'Equity',
  'Co-op',
  'Absa',
  'Standard Chartered',
  'NCBA',
  'I&M',
  'DTB',
  'Family',
  'Gulf African',
];
const VEHICLE_MAKES = [
  'Toyota',
  'Nissan',
  'Mazda',
  'Subaru',
  'Honda',
  'Mitsubishi',
  'Isuzu',
  'Volkswagen',
];
const VEHICLE_MODELS = ['Corolla', 'Axela', 'Demio', 'Impreza', 'Fit', 'Lancer', 'D-Max', 'Golf'];

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

function randomDate(startYear: number, endYear: number, seed: string): string {
  const year = startYear + (hash(seed) % (endYear - startYear + 1));
  const month = String(1 + (hash(`m${seed}`) % 12)).padStart(2, '0');
  const day = String(1 + (hash(`d${seed}`) % 28)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizePhone(phone: string): string {
  return phone.replace(/^(\+?254|0)/, '+254');
}

function generateIdNumber(seed: string): string {
  return `${7000000 + (hash(seed) % 30000000)}`;
}

function generateKraPin(idNumber: string): string {
  return `A${idNumber.slice(0, 8)}Z`;
}

/**
 * Deterministic mock provider: same input always returns the same
 * realistic-looking data. Doubles as the sandbox provider and test fixture.
 */
export class MockProvider implements VerificationProvider {
  readonly name = 'mock';
  readonly sandbox = true;
  readonly supported = Object.values(VerificationType);

  // ===== Identity — Standard =====

  async iprsStandardLookup(idNumber: string): Promise<IprsStandardResult> {
    assertSupported(VerificationType.IPRS_STANDARD, this.supported);
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
      photoBase64: null,
      aliveStatus: hash(`a${idNumber}`) % 50 !== 0,
    };
  }

  async matchIdPhone(input: {
    idNumber: string;
    phoneNumber: string;
  }): Promise<MatchIdPhoneResult> {
    assertSupported(VerificationType.MATCH_ID_PHONE, this.supported);
    if (!/^\d{7,9}$/.test(input.idNumber)) {
      throw new ProviderError('INVALID_INPUT', 'ID number must be 7-9 digits');
    }
    if (!/^(\+?254|0)7\d{8}$/.test(input.phoneNumber.replace(/\s/g, ''))) {
      throw new ProviderError('INVALID_INPUT', 'Phone must be a valid Kenyan mobile number');
    }

    const seed = `${input.idNumber}|${input.phoneNumber}`;
    const match = hash(seed) % 10 !== 0; // 90% match rate

    return {
      idNumber: input.idNumber,
      phoneNumber: normalizePhone(input.phoneNumber),
      match,
      ownerName: `${pick(FIRST_NAMES, seed)} ${pick(SURNAMES, `p${seed}`)}`,
    };
  }

  async employerVerification(input: EmployerInput): Promise<EmployerVerificationResult> {
    assertSupported(VerificationType.EMPLOYER_VERIFICATION, this.supported);
    if (!/^\d{7,9}$/.test(input.idNumber)) {
      throw new ProviderError('INVALID_INPUT', 'ID number must be 7-9 digits');
    }

    const isCurrent = hash(input.employerName) % 3 !== 0; // ~66% current
    const statuses: ('active' | 'inactive' | 'unknown')[] = ['active', 'inactive', 'unknown'];

    return {
      idNumber: input.idNumber,
      employerName: input.employerName,
      isCurrentEmployer: isCurrent,
      employmentStatus: pick(statuses, `es${input.idNumber}`),
    };
  }

  async faceIdMatch(input: FaceIdInput): Promise<FaceIdMatchResult> {
    assertSupported(VerificationType.FACE_ID_MATCH, this.supported);
    if (!/^\d{7,9}$/.test(input.idNumber)) {
      throw new ProviderError('INVALID_INPUT', 'ID number must be 7-9 digits');
    }
    if (!input.faceImageBase64 || input.faceImageBase64.length < 100) {
      throw new ProviderError('INVALID_INPUT', 'Face image is required');
    }

    const matchScore = 50 + (hash(input.idNumber) % 50); // 50-99
    const matched = matchScore >= 70;

    return {
      idNumber: input.idNumber,
      matchScore,
      matched,
      referenceImageBase64: undefined,
    };
  }

  async bankAccountVerification(input: BankAccountInput): Promise<BankAccountVerificationResult> {
    assertSupported(VerificationType.BANK_ACCOUNT_VERIFICATION, this.supported);
    if (!input.accountNumber || input.accountNumber.length < 8) {
      throw new ProviderError('INVALID_INPUT', 'Account number is required');
    }
    if (!input.bankCode || input.bankCode.length < 3) {
      throw new ProviderError('INVALID_INPUT', 'Bank code is required');
    }

    const seed = `${input.accountNumber}|${input.bankCode}`;
    const statuses: ('active' | 'dormant' | 'closed' | 'unknown')[] = [
      'active',
      'dormant',
      'closed',
      'unknown',
    ];
    const idMatch = input.idNumber ? hash(seed) % 5 !== 0 : true; // 80% match if ID provided

    return {
      accountNumber: input.accountNumber,
      bankCode: input.bankCode,
      bankName: pick(BANKS, `bn${input.bankCode}`),
      accountName: `${pick(FIRST_NAMES, seed)} ${pick(SURNAMES, `sn${seed}`)}`,
      accountStatus: pick(statuses, `as${seed}`),
      idNumberMatch: idMatch,
    };
  }

  // ===== Identity — Premium =====

  async alienIdLookup(input: AlienIdInput): Promise<AlienIdResult> {
    assertSupported(VerificationType.ALIEN_ID, this.supported);
    if (!input.alienId || input.alienId.length < 8) {
      throw new ProviderError('INVALID_INPUT', 'Alien ID is required');
    }

    const statuses: ('valid' | 'expired' | 'invalid')[] = ['valid', 'expired', 'invalid'];
    const nationalities = [
      'Ugandan',
      'Tanzanian',
      'Rwandan',
      'South Sudanese',
      'Congolese',
      'Somali',
      'Ethiopian',
    ];

    return {
      alienId: input.alienId,
      fullName: `${pick(SURNAMES, input.alienId)} ${pick(FIRST_NAMES, `fn${input.alienId}`)}`,
      nationality: pick(nationalities, `nat${input.alienId}`),
      dateOfBirth: randomDate(1960, 2005, `dob${input.alienId}`),
      gender: hash(`g${input.alienId}`) % 2 === 0 ? 'MALE' : 'FEMALE',
      expiryDate: randomDate(2024, 2035, `exp${input.alienId}`),
      status: pick(statuses, `st${input.alienId}`),
    };
  }

  async amlPepScreen(idNumber: string): Promise<AmlPepScreenResult> {
    assertSupported(VerificationType.AML_PEP_SCREEN, this.supported);
    if (!/^\d{7,9}$/.test(idNumber)) {
      throw new ProviderError('INVALID_INPUT', 'ID number must be 7-9 digits');
    }

    const amlMatch = hash(`aml${idNumber}`) % 20 === 0; // 5% match
    const pepMatch = hash(`pep${idNumber}`) % 50 === 0; // 2% match
    const watchlists = ['UN Sanctions', 'OFAC', 'EU Consolidated', 'UK HMT', 'Local Watchlist'];

    return {
      idNumber,
      fullName: `${pick(SURNAMES, idNumber)} ${pick(FIRST_NAMES, `fn${idNumber}`)}`,
      amlMatch,
      pepMatch,
      watchlistMatches: amlMatch || pepMatch ? [pick(watchlists, `wl${idNumber}`)] : [],
      riskLevel:
        amlMatch || pepMatch ? pick(['low', 'medium', 'high', 'critical'], `rl${idNumber}`) : 'low',
    };
  }

  async passportCheck(input: PassportInput): Promise<PassportCheckResult> {
    assertSupported(VerificationType.PASSPORT_CHECK, this.supported);
    if (!input.passportNumber || input.passportNumber.length < 6) {
      throw new ProviderError('INVALID_INPUT', 'Passport number is required');
    }

    const statuses: ('valid' | 'expired' | 'invalid')[] = ['valid', 'expired', 'invalid'];
    const countries = [
      'Kenya',
      'Uganda',
      'Tanzania',
      'Rwanda',
      'South Sudan',
      'UK',
      'USA',
      'Canada',
    ];

    return {
      passportNumber: input.passportNumber,
      nationality: input.nationality,
      fullName: `${pick(SURNAMES, input.passportNumber)} ${pick(FIRST_NAMES, `fn${input.passportNumber}`)}`,
      dateOfBirth: randomDate(1960, 2005, `dob${input.passportNumber}`),
      gender: hash(`g${input.passportNumber}`) % 2 === 0 ? 'MALE' : 'FEMALE',
      expiryDate: randomDate(2024, 2035, `exp${input.passportNumber}`),
      issuingCountry: pick(countries, `ic${input.passportNumber}`),
      status: pick(statuses, `st${input.passportNumber}`),
    };
  }

  // ===== Utility =====

  async simSwapCheck(phoneNumber: string): Promise<SimSwapCheckResult> {
    assertSupported(VerificationType.SIM_SWAP_CHECK, this.supported);
    if (!/^(\+?254|0)7\d{8}$/.test(phoneNumber.replace(/\s/g, ''))) {
      throw new ProviderError('INVALID_INPUT', 'Phone must be a valid Kenyan mobile number');
    }
    const days = hash(phoneNumber) % 400;
    return {
      phoneNumber: normalizePhone(phoneNumber),
      lastSwapDate:
        days > 2
          ? new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
          : new Date(Date.now() - (days + 3) * 86_400_000).toISOString().slice(0, 10),
      daysSinceSwap: days,
      riskLevel: days < 14 ? 'high' : days < 90 ? 'medium' : 'low',
    };
  }

  async kplcLocationChecker(input: MeterInput): Promise<KplcLocationCheckerResult> {
    assertSupported(VerificationType.KPLC_LOCATION_CHECKER, this.supported);
    if (!input.meterNumber || input.meterNumber.length < 8) {
      throw new ProviderError('INVALID_INPUT', 'Meter number is required');
    }

    const statuses: ('active' | 'inactive' | 'disconnected')[] = [
      'active',
      'inactive',
      'disconnected',
    ];

    return {
      meterNumber: input.meterNumber,
      accountNumber: `${1000000 + (hash(input.meterNumber) % 9000000)}`,
      customerName: `${pick(FIRST_NAMES, input.meterNumber)} ${pick(SURNAMES, `sn${input.meterNumber}`)}`,
      location: pick(CITIES, `loc${input.meterNumber}`),
      status: pick(statuses, `st${input.meterNumber}`),
    };
  }

  async kraPinCheck(input: KraInput): Promise<KraPinVerificationResult> {
    assertSupported(VerificationType.KRA_PIN_VERIFICATION, this.supported);
    const pin = input.kraPin ?? (input.idNumber ? generateKraPin(input.idNumber) : undefined);
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

  async searchNameByPhone(phoneNumber: string): Promise<SearchNameByPhoneResult> {
    assertSupported(VerificationType.SEARCH_NAME_BY_PHONE, this.supported);
    if (!/^(\+?254|0)7\d{8}$/.test(phoneNumber.replace(/\s/g, ''))) {
      throw new ProviderError('INVALID_INPUT', 'Phone must be a valid Kenyan mobile number');
    }

    const seed = normalizePhone(phoneNumber);
    return {
      phoneNumber: seed,
      ownerName: `${pick(FIRST_NAMES, seed)} ${pick(SURNAMES, `sn${seed}`)}`,
      idNumber: `${7000000 + (hash(seed) % 30000000)}`,
    };
  }

  // ===== Identity & CRB =====

  async searchPhonesById(idNumber: string): Promise<SearchPhonesByIdResult> {
    assertSupported(VerificationType.SEARCH_PHONES_BY_ID, this.supported);
    if (!/^\d{7,9}$/.test(idNumber)) {
      throw new ProviderError('INVALID_INPUT', 'ID number must be 7-9 digits');
    }

    const count = 1 + (hash(`c${idNumber}`) % 3);
    const normalized = `+2547${hash(idNumber) % 100000000}`;
    const numbers = Array.from({ length: count }, (_, i) =>
      i === 0
        ? normalized
        : `${normalized.slice(0, 6)}${(hash(`n${idNumber}${i}`) % 10000000) + 7000000}`,
    );

    return {
      idNumber,
      registeredNumbers: numbers,
      primaryNumber: numbers[0],
    };
  }

  // ===== Vehicle =====

  async motorVehicleOwnership(input: VehicleInput): Promise<MotorVehicleOwnershipResult> {
    assertSupported(VerificationType.MOTOR_VEHICLE_OWNERSHIP, this.supported);
    if (!input.vehicleRegNumber || input.vehicleRegNumber.length < 6) {
      throw new ProviderError('INVALID_INPUT', 'Vehicle registration number is required');
    }

    const logbookStatuses: ('valid' | 'expired' | 'cancelled')[] = [
      'valid',
      'expired',
      'cancelled',
    ];
    const ownerId = generateIdNumber(input.vehicleRegNumber);

    return {
      vehicleRegNumber: input.vehicleRegNumber,
      ownerIdNumber: ownerId,
      ownerName: `${pick(SURNAMES, input.vehicleRegNumber)} ${pick(FIRST_NAMES, `fn${input.vehicleRegNumber}`)}`,
      make: pick(VEHICLE_MAKES, `mk${input.vehicleRegNumber}`),
      model: pick(VEHICLE_MODELS, `md${input.vehicleRegNumber}`),
      year: 2010 + (hash(`yr${input.vehicleRegNumber}`) % 15),
      color: pick(
        ['White', 'Silver', 'Black', 'Blue', 'Red', 'Grey'],
        `clr${input.vehicleRegNumber}`,
      ),
      engineNumber: `ENG${hash(`en${input.vehicleRegNumber}`)}`.slice(0, 10).padStart(10, '0'),
      chassisNumber: `CHS${hash(`ch${input.vehicleRegNumber}`)}`.slice(0, 17).padStart(17, '0'),
      logbookStatus: pick(logbookStatuses, `ls${input.vehicleRegNumber}`),
    };
  }

  async driversLicenseVerification(
    input: DriversLicenseInput,
  ): Promise<DriversLicenseVerificationResult> {
    assertSupported(VerificationType.DRIVERS_LICENSE_VERIFICATION, this.supported);
    if (!input.dlNumber || input.dlNumber.length < 8) {
      throw new ProviderError('INVALID_INPUT', "Driver's license number is required");
    }

    const statuses: ('valid' | 'expired' | 'suspended' | 'revoked')[] = [
      'valid',
      'expired',
      'suspended',
      'revoked',
    ];
    const classes = ['BCE', 'BC', 'B', 'C', 'CE', 'D', 'DE', 'A'];

    return {
      dlNumber: input.dlNumber,
      idNumber: generateIdNumber(input.dlNumber),
      fullName: `${pick(SURNAMES, input.dlNumber)} ${pick(FIRST_NAMES, `fn${input.dlNumber}`)}`,
      dateOfBirth: randomDate(1960, 2005, `dob${input.dlNumber}`),
      licenseClass: pick(classes, `cl${input.dlNumber}`),
      issueDate: randomDate(2010, 2023, `iss${input.dlNumber}`),
      expiryDate: randomDate(2024, 2035, `exp${input.dlNumber}`),
      status: pick(statuses, `st${input.dlNumber}`),
    };
  }

  // ===== Credit Reference — Metropol =====

  async metropolScoreOnly(idNumber: string): Promise<MetropolScoreOnlyResult> {
    assertSupported(VerificationType.METROPOL_SCORE_ONLY, this.supported);
    if (!/^\d{7,9}$/.test(idNumber)) {
      throw new ProviderError('INVALID_INPUT', 'ID number must be 7-9 digits');
    }

    const score = 300 + (hash(`ms${idNumber}`) % 550); // 300-850
    const bands = [
      'Poor (300-499)',
      'Fair (500-599)',
      'Good (600-699)',
      'Very Good (700-749)',
      'Excellent (750-850)',
    ];

    return {
      score,
      scoreBand: pick(bands, `sb${idNumber}`),
      riskLevel: score >= 700 ? 'low' : score >= 550 ? 'medium' : 'high',
    };
  }

  async metropolStandardReport(idNumber: string): Promise<MetropolStandardReportResult> {
    assertSupported(VerificationType.METROPOL_STANDARD_REPORT, this.supported);
    if (!/^\d{7,9}$/.test(idNumber)) {
      throw new ProviderError('INVALID_INPUT', 'ID number must be 7-9 digits');
    }

    const score = 300 + (hash(`ms${idNumber}`) % 550);
    const bands = [
      'Poor (300-499)',
      'Fair (500-599)',
      'Good (600-699)',
      'Very Good (700-749)',
      'Excellent (750-850)',
    ];

    return {
      score,
      scoreBand: pick(bands, `sb${idNumber}`),
      accountsSummary: {
        total: 1 + (hash(`ta${idNumber}`) % 5),
        active: 1 + (hash(`aa${idNumber}`) % 3),
        closed: hash(`ca${idNumber}`) % 3,
        defaulted: hash(`da${idNumber}`) % 2,
      },
      paymentHistory: [
        { accountType: 'Personal Loan', status: 'Current', monthsInArrears: 0 },
        { accountType: 'Credit Card', status: 'Current', monthsInArrears: 0 },
        {
          accountType: 'Mortgage',
          status: hash(`mh${idNumber}`) % 3 === 0 ? 'Arrears' : 'Current',
          monthsInArrears: hash(`ma${idNumber}`) % 3,
        },
      ],
    };
  }

  async metropolFullReport(idNumber: string): Promise<MetropolFullReportResult> {
    assertSupported(VerificationType.METROPOL_FULL_REPORT, this.supported);
    if (!/^\d{7,9}$/.test(idNumber)) {
      throw new ProviderError('INVALID_INPUT', 'ID number must be 7-9 digits');
    }

    const score = 300 + (hash(`ms${idNumber}`) % 550);
    const bands = [
      'Poor (300-499)',
      'Fair (500-599)',
      'Good (600-699)',
      'Very Good (700-749)',
      'Excellent (750-850)',
    ];

    return {
      score,
      scoreBand: pick(bands, `sb${idNumber}`),
      identity: {
        idNumber,
        fullName: `${pick(SURNAMES, idNumber)} ${pick(FIRST_NAMES, `fn${idNumber}`)}`,
        dateOfBirth: randomDate(1960, 2005, `dob${idNumber}`),
      },
      accounts: [
        {
          accountType: 'Personal Loan',
          institution: pick(BANKS, `bk${idNumber}`),
          balance: 50000 + (hash(`b1${idNumber}`) % 500000),
          status: 'Active',
          openedDate: randomDate(2015, 2023, `od${idNumber}`),
          paymentHistory: 'Current',
        },
        {
          accountType: 'Credit Card',
          institution: pick(BANKS, `bk2${idNumber}`),
          balance: 10000 + (hash(`b2${idNumber}`) % 100000),
          status: 'Active',
          openedDate: randomDate(2018, 2023, `od2${idNumber}`),
          paymentHistory: 'Current',
        },
      ],
      inquiries: [
        {
          date: randomDate(2023, 2024, `inq1${idNumber}`),
          institution: pick(BANKS, `inqb1${idNumber}`),
          purpose: 'Credit Application',
        },
        {
          date: randomDate(2023, 2024, `inq2${idNumber}`),
          institution: pick(BANKS, `inqb2${idNumber}`),
          purpose: 'Loan Review',
        },
      ],
      publicRecords:
        hash(`pr${idNumber}`) % 5 === 0
          ? [
              {
                type: 'Court Judgment',
                amount: 50000 + (hash(`pa${idNumber}`) % 200000),
                date: randomDate(2020, 2023, `prd${idNumber}`),
                status: 'Satisfied',
              },
            ]
          : [],
    };
  }

  // ===== Credit Reference — CreditInfo =====

  async creditInfoScoreOnly(idNumber: string): Promise<CreditInfoScoreOnlyResult> {
    assertSupported(VerificationType.CREDITINFO_SCORE_ONLY, this.supported);
    if (!/^\d{7,9}$/.test(idNumber)) {
      throw new ProviderError('INVALID_INPUT', 'ID number must be 7-9 digits');
    }

    const score = 300 + (hash(`ci${idNumber}`) % 550);
    return {
      score,
      scoreBand:
        score >= 750
          ? 'Excellent'
          : score >= 700
            ? 'Very Good'
            : score >= 650
              ? 'Good'
              : score >= 600
                ? 'Fair'
                : 'Poor',
      riskLevel: score >= 700 ? 'low' : score >= 600 ? 'medium' : 'high',
    };
  }

  async creditInfoComprehensive(idNumber: string): Promise<CreditInfoComprehensiveResult> {
    assertSupported(VerificationType.CREDITINFO_COMPREHENSIVE, this.supported);
    if (!/^\d{7,9}$/.test(idNumber)) {
      throw new ProviderError('INVALID_INPUT', 'ID number must be 7-9 digits');
    }

    return {
      score: 300 + (hash(`ci${idNumber}`) % 550),
      scoreBand: 'Good',
      identity: {
        idNumber,
        fullName: `${pick(SURNAMES, idNumber)} ${pick(FIRST_NAMES, `fn${idNumber}`)}`,
      },
      creditAccounts: [
        {
          lender: pick(BANKS, `cl${idNumber}`),
          productType: 'Personal Loan',
          balance: 100000 + (hash(`b1${idNumber}`) % 1000000),
          status: 'Active',
          limit: 2000000,
          repaymentHistory: '000000000000', // 12 months current
        },
        {
          lender: pick(BANKS, `cl2${idNumber}`),
          productType: 'Credit Card',
          balance: 50000 + (hash(`b2${idNumber}`) % 300000),
          status: 'Active',
          limit: 500000,
          repaymentHistory: '000000000000',
        },
      ],
      guarantees:
        hash(`gu${idNumber}`) % 3 === 0
          ? [
              {
                borrower: `${pick(SURNAMES, `g${idNumber}`)} ${pick(FIRST_NAMES, `gfn${idNumber}`)}`,
                amount: 500000,
                status: 'Active',
              },
            ]
          : [],
    };
  }

  async creditInfoCrbStatus(idNumber: string): Promise<CreditInfoCrbStatusResult> {
    assertSupported(VerificationType.CREDITINFO_CRB_STATUS, this.supported);
    if (!/^\d{7,9}$/.test(idNumber)) {
      throw new ProviderError('INVALID_INPUT', 'ID number must be 7-9 digits');
    }

    const listed = hash(`crb${idNumber}`) % 10 === 0; // 10% listed

    return {
      status: listed ? 'listed' : 'clear',
      listingDetails: listed
        ? [
            {
              lender: pick(BANKS, `lbl${idNumber}`),
              amount: 100000 + (hash(`la${idNumber}`) % 500000),
              dateListed: randomDate(2020, 2024, `dl${idNumber}`),
              status: 'Outstanding',
            },
          ]
        : undefined,
    };
  }

  // ===== KYB =====

  async brsLookup(input: BusinessRegInput): Promise<BrsResult> {
    assertSupported(VerificationType.BRS, this.supported);
    if (!input.businessRegNumber || input.businessRegNumber.length < 6) {
      throw new ProviderError('INVALID_INPUT', 'Business registration number is required');
    }

    const statuses: ('active' | 'dormant' | 'dissolved')[] = ['active', 'dormant', 'dissolved'];
    const businessTypes = [
      'Private Limited Company',
      'Public Limited Company',
      'Sole Proprietorship',
      'Partnership',
    ];

    return {
      businessRegNumber: input.businessRegNumber,
      businessName: `${pick(SURNAMES, input.businessRegNumber)} ${pick(FIRST_NAMES, `bn${input.businessRegNumber}`)} Enterprises`,
      registrationDate: randomDate(2000, 2023, `rd${input.businessRegNumber}`),
      status: pick(statuses, `bs${input.businessRegNumber}`),
      directors: [
        {
          name: `${pick(SURNAMES, `d1${input.businessRegNumber}`)} ${pick(FIRST_NAMES, `dfn1${input.businessRegNumber}`)}`,
          idNumber: generateIdNumber(`d1${input.businessRegNumber}`),
          role: 'Director',
        },
        {
          name: `${pick(SURNAMES, `d2${input.businessRegNumber}`)} ${pick(FIRST_NAMES, `dfn2${input.businessRegNumber}`)}`,
          idNumber: generateIdNumber(`d2${input.businessRegNumber}`),
          role: 'Secretary',
        },
      ],
      shareholders: [
        {
          name: `${pick(SURNAMES, `sh1${input.businessRegNumber}`)} ${pick(FIRST_NAMES, `sfn1${input.businessRegNumber}`)}`,
          idNumber: generateIdNumber(`sh1${input.businessRegNumber}`),
          shares: 60,
        },
        {
          name: `${pick(SURNAMES, `sh2${input.businessRegNumber}`)} ${pick(FIRST_NAMES, `sfn2${input.businessRegNumber}`)}`,
          idNumber: generateIdNumber(`sh2${input.businessRegNumber}`),
          shares: 40,
        },
      ],
      registeredAddress: `${pick(CITIES, `addr${input.businessRegNumber}`)}, Kenya`,
      businessType: pick(businessTypes, `bt${input.businessRegNumber}`),
    };
  }

  // ===== Analytics =====

  async spinScoreOnly(idNumber: string): Promise<SpinScoreOnlyResult> {
    assertSupported(VerificationType.SPIN_SCORE_ONLY, this.supported);
    if (!/^\d{7,9}$/.test(idNumber)) {
      throw new ProviderError('INVALID_INPUT', 'ID number must be 7-9 digits');
    }

    const score = 1 + (hash(`ss${idNumber}`) % 100); // 1-100

    return {
      score,
      scoreBand:
        score >= 80
          ? 'A (80-100)'
          : score >= 60
            ? 'B (60-79)'
            : score >= 40
              ? 'C (40-59)'
              : score >= 20
                ? 'D (20-39)'
                : 'E (1-19)',
      riskLevel: score >= 60 ? 'low' : score >= 30 ? 'medium' : 'high',
      factors: [
        {
          factor: 'Payment History',
          impact: hash(`f1${idNumber}`) % 2 === 0 ? 'positive' : 'negative',
          weight: 35,
        },
        {
          factor: 'Credit Utilization',
          impact: hash(`f2${idNumber}`) % 2 === 0 ? 'positive' : 'negative',
          weight: 30,
        },
        {
          factor: 'Credit Age',
          impact: hash(`f3${idNumber}`) % 2 === 0 ? 'positive' : 'negative',
          weight: 15,
        },
        {
          factor: 'Credit Mix',
          impact: hash(`f4${idNumber}`) % 2 === 0 ? 'positive' : 'negative',
          weight: 10,
        },
        {
          factor: 'Recent Inquiries',
          impact: hash(`f5${idNumber}`) % 2 === 0 ? 'positive' : 'negative',
          weight: 10,
        },
      ],
    };
  }

  async scannedStatementAnalysis(input: ScannedStatementInput): Promise<ScannedStatementResult> {
    assertSupported(VerificationType.SCANNED_STATEMENT, this.supported);
    if (!input.statementPages || input.statementPages < 1) {
      throw new ProviderError('INVALID_INPUT', 'Statement pages must be at least 1');
    }

    const txCount = input.statementPages * 10 + (hash(`tx${input.statementPages}`) % 20);
    const transactions = Array.from({ length: txCount }, (_, i) => ({
      date: randomDate(2023, 2024, `txd${input.statementPages}${i}`),
      description: pick(
        [
          'M-Pesa Receive',
          'M-Pesa Send',
          'Bank Transfer',
          'Card Payment',
          'Salary',
          'Bill Payment',
          'Airtime',
          'Loan Repayment',
        ],
        `txdesc${i}`,
      ),
      amount: 100 + (hash(`txa${input.statementPages}${i}`) % 50000),
      type:
        hash(`txt${input.statementPages}${i}`) % 2 === 0 ? ('credit' as const) : ('debit' as const),
      balance: 10000 + (hash(`txb${input.statementPages}${i}`) % 1000000),
    }));

    const totalCredits = transactions
      .filter((t) => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalDebits = transactions
      .filter((t) => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      pagesProcessed: input.statementPages,
      transactions,
      summary: {
        totalCredits,
        totalDebits,
        openingBalance: 50000 + (hash(`ob${input.statementPages}`) % 500000),
        closingBalance: 50000 + (hash(`cb${input.statementPages}`) % 500000),
        transactionCount: txCount,
      },
    };
  }
}
