import SecretsManager from '@aws-sdk/client-secrets-manager';
import process from 'node:process';
export type AdminCert = {
    cert: string;
    key: string;
};
/** How often the admin certificate secret is re-read when CLOUDTAK_Server_auth_p12_refresh_interval is unset (seconds) */
export const DEFAULT_REFRESH_INTERVAL = 3600;
/**
 * Is the admin certificate sourced from a Secrets Manager P12 (the only source that can change under a running server)?
 */
export function adminCertFromSecret(): boolean {
    return !!process.env.CLOUDTAK_Server_auth_p12_secret_arn
        && !!process.env.CLOUDTAK_Server_auth_password
        && !(process.env.CLOUDTAK_Server_auth_cert && process.env.CLOUDTAK_Server_auth_key);
}
/**
 * Refresh interval in milliseconds. 0 disables the periodic reload
 * (CLOUDTAK_Server_auth_p12_refresh_interval, in seconds)
 */
export function refreshIntervalMs(): number {
    const raw = process.env.CLOUDTAK_Server_auth_p12_refresh_interval;
    if (raw === undefined || raw === '') return DEFAULT_REFRESH_INTERVAL * 1000;
    const seconds = Number(raw);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : DEFAULT_REFRESH_INTERVAL * 1000;
}
/**
 * Read the TAK Server admin certificate from the P12 in Secrets Manager.
 *
 * Returns undefined when no secret is configured or it has no binary value. Throws when the
 * secret cannot be fetched or the P12 cannot be read, so callers can keep the certificate they have
 *
 * pem.readPkcs12 is kept as the reader: it handles the 3DES and RC2-40 encrypted files
 */
export async function loadAdminCertFromSecret(): Promise<AdminCert | undefined> {
    if (!adminCertFromSecret()) return undefined;
    const secrets = new SecretsManager.SecretsManagerClient({ region: process.env.AWS_REGION });
    const secretValue = await secrets.send(new SecretsManager.GetSecretValueCommand({
        SecretId: process.env.CLOUDTAK_Server_auth_p12_secret_arn,
    }));
    if (!secretValue.SecretBinary) return undefined;
    const pem = (await import('pem')).default;
    const p12Buffer = Buffer.from(secretValue.SecretBinary);
    return await new Promise<AdminCert>((resolve, reject) => {
        pem.readPkcs12(p12Buffer, { p12Password: process.env.CLOUDTAK_Server_auth_password }, (e: Error | null, result: { cert: string; key: string }) => {
            if (e) {
                reject(e);
            } else {
                resolve({ cert: result.cert, key: result.key });
            }
        });
    });
}
