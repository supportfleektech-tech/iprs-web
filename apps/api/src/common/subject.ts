/**
 * Single source of truth for extracting a human-readable subject identifier
 * from a decrypted verification input payload. Used by history, batches and
 * exports to keep the field-priority list consistent.
 */
export function getSubjectFromInput(
  input: Record<string, string | number | boolean | null | undefined>,
): string {
  const candidates = [
    input.kraPin,
    input.phoneNumber,
    input.idNumber,
    input.alienId,
    input.passportNumber,
    input.vehicleRegNumber,
    input.dlNumber,
    input.businessRegNumber,
    input.meterNumber,
    input.statementPages,
  ];
  const found = candidates.find((v) => v !== null && v !== undefined);
  return found !== undefined ? String(found) : '—';
}
