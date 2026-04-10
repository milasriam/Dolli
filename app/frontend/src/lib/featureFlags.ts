/**
 * Build-time flags (Vite). Set in `.env` or on the deploy line, e.g. VITE_PAYMENTS_ENABLED=false.
 */
export function isPaymentsEnabled(): boolean {
  const v = import.meta.env.VITE_PAYMENTS_ENABLED;
  if (v === undefined || v === null || String(v).trim() === '') {
    return true;
  }
  const s = String(v).trim().toLowerCase();
  return s !== 'false' && s !== '0' && s !== 'off' && s !== 'no';
}
