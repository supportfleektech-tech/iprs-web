export const appConfig = {
  port: parseInt(process.env.PORT ?? '4000', 10),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-jwt-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  refreshExpiresIn: process.env.REFRESH_EXPIRES_IN ?? '7d',
  fieldEncryptionKey: process.env.FIELD_ENCRYPTION_KEY ?? 'dev-only-field-key-change-me',
  enabledChecks: (process.env.ENABLED_CHECKS ?? 'iprs_id,kra_pin,phone_ownership,sim_swap').split(
    ',',
  ) as import('@fleek/types').VerificationType[],
  useLiveUpstream: process.env.USE_LIVE_UPSTREAM === 'true',
};
