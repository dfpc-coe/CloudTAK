/**
 * Shared certificate expiry helpers for the public certificate metadata
 * (`{ subject, validFrom, validTo }`) returned by the Connection, Server & User APIs
 */

export type CertificateMetadata = {
    subject?: string | null;
    validFrom?: string | null;
    validTo?: string | null;
};

export type CertificateExpiryState = 'expired' | 'near-expiry' | null;

export const NEAR_EXPIRY_MS = 14 * 24 * 60 * 60 * 1000;

export function certificateExpiryState(
    validTo?: string | null,
    now: number = Date.now(),
    nearExpiryMs: number = NEAR_EXPIRY_MS,
): CertificateExpiryState {
    if (!validTo) return null;

    const expiry = Date.parse(validTo);
    if (Number.isNaN(expiry)) return null;

    const remaining = expiry - now;
    if (remaining < 0) return 'expired';
    if (remaining <= nearExpiryMs) return 'near-expiry';

    return null;
}
