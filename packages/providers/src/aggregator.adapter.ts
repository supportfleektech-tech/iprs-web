import type {
  VerificationType,
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
import { ProviderError } from './provider';
import type {
  KraInput,
  FaceIdInput,
  BankAccountInput,
  AlienIdInput,
  PassportInput,
  EmployerInput,
  MeterInput,
  VehicleInput,
  DriversLicenseInput,
  BusinessRegInput,
  ScannedStatementInput,
  VerificationProvider,
} from './provider';

export interface AggregatorConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}

/**
 * Adapter for a generic HTTP verification aggregator (e.g., SPIN Mobile).
 *
 * Expected upstream contract (configure your aggregator to match, or adapt
 * the mapping methods below to its actual shapes):
 *
 *   Authorization: Bearer <apiKey>
 *   POST {base}/kenya/iprs-standard      {"idNumber": "12345678"}
 *   POST {base}/kenya/match-id-phone     {"idNumber": "...", "phoneNumber": "..."}
 *   POST {base}/kenya/employer           {"idNumber": "...", "employerName": "..."}
 *   POST {base}/kenya/face-match         {"idNumber": "...", "faceImageBase64": "..."}
 *   POST {base}/kenya/bank-account       {"accountNumber": "...", "bankCode": "...", "idNumber?": "..."}
 *   POST {base}/kenya/alien-id           {"alienId": "..."}
 *   POST {base}/kenya/aml-pep            {"idNumber": "..."}
 *   POST {base}/kenya/passport           {"passportNumber": "...", "nationality": "..."}
 *   POST {base}/kenya/sim-swap           {"phoneNumber": "07..."}
 *   POST {base}/kenya/kplc               {"meterNumber": "..."}
 *   POST {base}/kenya/kra-pin            {"kraPin"?: "...", "idNumber"?: "..."}
 *   POST {base}/kenya/search-name-phone  {"phoneNumber": "..."}
 *   POST {base}/kenya/search-phones-id   {"idNumber": "..."}
 *   POST {base}/kenya/vehicle            {"vehicleRegNumber": "..."}
 *   POST {base}/kenya/drivers-license    {"dlNumber": "..."}
 *   POST {base}/kenya/metropol/score     {"idNumber": "..."}
 *   POST {base}/kenya/metropol/standard  {"idNumber": "..."}
 *   POST {base}/kenya/metropol/full      {"idNumber": "..."}
 *   POST {base}/kenya/creditinfo/score   {"idNumber": "..."}
 *   POST {base}/kenya/creditinfo/comprehensive {"idNumber": "..."}
 *   POST {base}/kenya/creditinfo/crb     {"idNumber": "..."}
 *   POST {base}/kenya/brs                {"businessRegNumber": "..."}
 *   POST {base}/kenya/spin-score         {"idNumber": "..."}
 *   POST {base}/kenya/scanned-statement  {"statementPages": N, "fileBase64"?: "..."}
 *
 * Non-200 responses and 404s map to ProviderError codes so the platform
 * billing rules (only conclusive results are billed) keep working unchanged.
 */
export class AggregatorAdapter implements VerificationProvider {
  readonly name: string;
  readonly sandbox = false;
  readonly supported: VerificationType[] = [
    'iprs_standard',
    'match_id_phone',
    'employer_verification',
    'face_id_match',
    'bank_account_verification',
    'alien_id',
    'aml_pep_screen',
    'passport_check',
    'sim_swap_check',
    'kplc_location_checker',
    'kra_pin_verification',
    'search_name_by_phone',
    'search_phones_by_id',
    'motor_vehicle_ownership',
    'drivers_license_verification',
    'metropol_score_only',
    'metropol_standard_report',
    'metropol_full_report',
    'creditinfo_score_only',
    'creditinfo_comprehensive',
    'creditinfo_crb_status',
    'brs',
    'spin_score_only',
    'scanned_statement',
  ] as VerificationType[];

  constructor(
    private readonly cfg: AggregatorConfig,
    name = 'aggregator',
  ) {
    this.name = name;
    this.timeoutMs = cfg.timeoutMs ?? 30_000; // Longer timeout for complex checks
  }

  private readonly timeoutMs: number;

  private async call<T>(path: string, payload: Record<string, unknown> | FormData): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const isFormData = payload instanceof FormData;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.cfg.apiKey}`,
      };
      if (!isFormData) {
        headers['Content-Type'] = 'application/json';
      }

      const res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, '')}${path}`, {
        method: 'POST',
        headers,
        body: isFormData ? payload : JSON.stringify(payload),
        signal: controller.signal,
      });

      if (res.status === 404) {
        throw new ProviderError('NOT_FOUND', `No record found at ${path}`);
      }
      if (res.status === 401 || res.status === 403) {
        throw new ProviderError('UPSTREAM_DOWN', 'Upstream rejected our API key');
      }
      if (!res.ok) {
        throw new ProviderError('UPSTREAM_DOWN', `Upstream error ${res.status} from ${path}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(
        err instanceof Error && err.name === 'AbortError' ? 'UPSTREAM_DOWN' : 'UNKNOWN',
        `Upstream call failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  // ===== Identity — Standard =====

  async iprsStandardLookup(idNumber: string): Promise<IprsStandardResult> {
    return this.call<IprsStandardResult>('/kenya/iprs-standard', { idNumber });
  }

  async matchIdPhone(input: {
    idNumber: string;
    phoneNumber: string;
  }): Promise<MatchIdPhoneResult> {
    return this.call<MatchIdPhoneResult>('/kenya/match-id-phone', input);
  }

  async employerVerification(input: EmployerInput): Promise<EmployerVerificationResult> {
    return this.call<EmployerVerificationResult>('/kenya/employer', input);
  }

  async faceIdMatch(input: FaceIdInput): Promise<FaceIdMatchResult> {
    // For file uploads, use FormData
    const formData = new FormData();
    formData.append('idNumber', input.idNumber);
    formData.append('faceImageBase64', input.faceImageBase64);
    return this.call<FaceIdMatchResult>('/kenya/face-match', formData);
  }

  async bankAccountVerification(input: BankAccountInput): Promise<BankAccountVerificationResult> {
    return this.call<BankAccountVerificationResult>('/kenya/bank-account', input);
  }

  // ===== Identity — Premium =====

  async alienIdLookup(input: AlienIdInput): Promise<AlienIdResult> {
    return this.call<AlienIdResult>('/kenya/alien-id', input);
  }

  async amlPepScreen(idNumber: string): Promise<AmlPepScreenResult> {
    return this.call<AmlPepScreenResult>('/kenya/aml-pep', { idNumber });
  }

  async passportCheck(input: PassportInput): Promise<PassportCheckResult> {
    return this.call<PassportCheckResult>('/kenya/passport', input);
  }

  // ===== Utility =====

  async simSwapCheck(phoneNumber: string): Promise<SimSwapCheckResult> {
    return this.call<SimSwapCheckResult>('/kenya/sim-swap', { phoneNumber });
  }

  async kplcLocationChecker(input: MeterInput): Promise<KplcLocationCheckerResult> {
    return this.call<KplcLocationCheckerResult>('/kenya/kplc', input);
  }

  async kraPinCheck(input: KraInput): Promise<KraPinVerificationResult> {
    return this.call<KraPinVerificationResult>('/kenya/kra-pin', input);
  }

  async searchNameByPhone(phoneNumber: string): Promise<SearchNameByPhoneResult> {
    return this.call<SearchNameByPhoneResult>('/kenya/search-name-phone', { phoneNumber });
  }

  // ===== Identity & CRB =====

  async searchPhonesById(idNumber: string): Promise<SearchPhonesByIdResult> {
    return this.call<SearchPhonesByIdResult>('/kenya/search-phones-id', { idNumber });
  }

  // ===== Vehicle =====

  async motorVehicleOwnership(input: VehicleInput): Promise<MotorVehicleOwnershipResult> {
    return this.call<MotorVehicleOwnershipResult>('/kenya/vehicle', input);
  }

  async driversLicenseVerification(
    input: DriversLicenseInput,
  ): Promise<DriversLicenseVerificationResult> {
    return this.call<DriversLicenseVerificationResult>('/kenya/drivers-license', input);
  }

  // ===== Credit Reference — Metropol =====

  async metropolScoreOnly(idNumber: string): Promise<MetropolScoreOnlyResult> {
    return this.call<MetropolScoreOnlyResult>('/kenya/metropol/score', { idNumber });
  }

  async metropolStandardReport(idNumber: string): Promise<MetropolStandardReportResult> {
    return this.call<MetropolStandardReportResult>('/kenya/metropol/standard', { idNumber });
  }

  async metropolFullReport(idNumber: string): Promise<MetropolFullReportResult> {
    return this.call<MetropolFullReportResult>('/kenya/metropol/full', { idNumber });
  }

  // ===== Credit Reference — CreditInfo =====

  async creditInfoScoreOnly(idNumber: string): Promise<CreditInfoScoreOnlyResult> {
    return this.call<CreditInfoScoreOnlyResult>('/kenya/creditinfo/score', { idNumber });
  }

  async creditInfoComprehensive(idNumber: string): Promise<CreditInfoComprehensiveResult> {
    return this.call<CreditInfoComprehensiveResult>('/kenya/creditinfo/comprehensive', {
      idNumber,
    });
  }

  async creditInfoCrbStatus(idNumber: string): Promise<CreditInfoCrbStatusResult> {
    return this.call<CreditInfoCrbStatusResult>('/kenya/creditinfo/crb', { idNumber });
  }

  // ===== KYB =====

  async brsLookup(input: BusinessRegInput): Promise<BrsResult> {
    return this.call<BrsResult>('/kenya/brs', input);
  }

  // ===== Analytics =====

  async spinScoreOnly(idNumber: string): Promise<SpinScoreOnlyResult> {
    return this.call<SpinScoreOnlyResult>('/kenya/spin-score', { idNumber });
  }

  async scannedStatementAnalysis(input: ScannedStatementInput): Promise<ScannedStatementResult> {
    // Use FormData for file upload
    const formData = new FormData();
    formData.append('statementPages', String(input.statementPages));
    if (input.fileBase64) {
      formData.append('fileBase64', input.fileBase64);
    }
    return this.call<ScannedStatementResult>('/kenya/scanned-statement', formData);
  }
}
