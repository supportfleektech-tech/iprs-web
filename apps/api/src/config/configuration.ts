import 'dotenv/config';
import { VerificationType, VERIFICATION_TYPES } from '@fleek/types';

function failFast(key: string, env: string): string {
  const value = process.env[env];
  if (!value) {
    throw new Error(`Missing required environment variable: ${env} (needed for ${key})`);
  }
  return value;
}

function getEnvOrDefault(key: string, env: string, defaultValue: string): string {
  return process.env[env] ?? defaultValue;
}

const isProduction = process.env.NODE_ENV === 'production';

export const appConfig = {
  port: parseInt(process.env.PORT ?? '4000', 10),
  jwtSecret: isProduction
    ? failFast('JWT_SECRET', 'JWT_SECRET')
    : getEnvOrDefault('JWT_SECRET', 'JWT_SECRET', 'dev-jwt-secret-change-in-production'),
  jwtExpiresIn: getEnvOrDefault('JWT_EXPIRES_IN', 'JWT_EXPIRES_IN', '15m'),
  refreshExpiresIn: getEnvOrDefault('REFRESH_EXPIRES_IN', 'REFRESH_EXPIRES_IN', '7d'),
  fieldEncryptionKey: isProduction
    ? failFast('FIELD_ENCRYPTION_KEY', 'FIELD_ENCRYPTION_KEY')
    : getEnvOrDefault(
        'FIELD_ENCRYPTION_KEY',
        'FIELD_ENCRYPTION_KEY',
        'dev-only-field-key-change-me',
      ),
  enabledChecks: getEnvOrDefault('ENABLED_CHECKS', 'ENABLED_CHECKS', VERIFICATION_TYPES.join(','))
    .split(',')
    .map((t) => t.trim())
    .filter((t): t is VerificationType => VERIFICATION_TYPES.includes(t as VerificationType)),
  useLiveUpstream: process.env.USE_LIVE_UPSTREAM === 'true',
  // Backup upstream config
  backupBaseUrl: process.env.BACKUP_BASE_URL,
  backupApiKey: process.env.BACKUP_API_KEY,
  backupChecks: (process.env.BACKUP_CHECKS ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter((t): t is VerificationType => VERIFICATION_TYPES.includes(t as VerificationType)),
  // Paybill constants
  paybillNumber: process.env.PAYBILL_NUMBER ?? '880100',
  paybillAccount: process.env.PAYBILL_ACCOUNT ?? '8402250011',
  bankName: process.env.BANK_NAME ?? 'NCBA',
  bankBranch: process.env.BANK_BRANCH ?? 'Uphill',
  accountName: process.env.ACCOUNT_NAME ?? 'SPIN MOBILE LIMITED',
  // SMTP mail transport — empty host = ConsoleMailer (log-only, dev/sandbox).
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: parseInt(process.env.SMTP_PORT ?? '587', 10),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpFrom: process.env.SMTP_FROM ?? 'Fleek IPRS <no-reply@fleekiprs.co.ke>',
} as const;
