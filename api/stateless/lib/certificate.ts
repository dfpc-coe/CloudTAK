import { Static } from '@sinclair/typebox';
import { X509Certificate } from 'node:crypto';
import { ConnectionAuth } from '../../common/connection-config.js';
import { spawnSync } from 'child_process';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, appendFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { CertificateResponse } from '../../common/types.js';

/**
 * TAK Server marks a client certificate as "channels enabled" by adding the
 * PKCS#9 Challenge Password OID to its Extended Key Usage extension
 */
export const CHANNELS_EKU_OID = '1.2.840.113549.1.9.7';

/**
 * Public metadata of an X509 certificate as returned by the Connection, Server & User APIs
 */
export function certificateMetadata(
    cert: string | X509Certificate,
): Static<typeof CertificateResponse> {
    const x509 = typeof cert === 'string' ? new X509Certificate(cert) : cert;

    return {
        subject: x509.subject,
        validFrom: x509.validFrom,
        validTo: x509.validTo,
        channels: (x509.keyUsage || []).includes(CHANNELS_EKU_OID),
    };
}

/**
 * Generates a PKCS#12 (PFX) file as a Buffer from PEM-encoded private key and certificate.
 * Relies on OpenSSL being available on the system.
 *
 * @param auth     - The connection authentication details containing key, cert, and optional CA certificates.
 * @param name     - The friendly name for the PKCS#12 entry.
 * @param password - Optional password to protect the PKCS#12 file. Defaults to an
 * @returns Buffer containing the PKCS#12 data.
 */
export async function generateClientP12(
    auth: Static<typeof ConnectionAuth>,
    name: string,
    password: string = '',
): Promise<Buffer> {
    const tmp = tmpdir();
    const rand = randomBytes(8).toString('hex');
    const keyPath = join(tmp, `key-${rand}.pem`);
    const certPath = join(tmp, `cert-${rand}.pem`);
    const p12Path = join(tmp, `out-${rand}.p12`);

    const paths = [keyPath, certPath, p12Path];

    try {
        await writeFile(keyPath, auth.key, { encoding: 'utf8' });
        await writeFile(certPath, auth.cert, { encoding: 'utf8' });

        const args = [
            'pkcs12',
            '-legacy',
            '-export',
            '-in', certPath,
            '-inkey', keyPath,
            '-out', p12Path,
            '-name', name,
        ];

        if (auth.ca && auth.ca.length) {
            const output = [];

            for (const cert of auth.ca) {
                try {
                    const x509 = new X509Certificate(Buffer.from(cert, 'base64'));
                    output.push(x509.toString());

                    await appendFile(certPath, '\n' + x509.toString() + '\n');
                } catch (err) {
                    console.error('Invalid CA certificate provided, skipping:', err);
                }
            }

            const caPath = join(tmp, `key-${rand}.crt`);
            paths.push(caPath);
            await writeFile(caPath, output.join('\n'), { encoding: 'utf8' });
            args.push('-CAfile', caPath);
        }

        if (password) {
            args.push('-password', `pass:${password}`);
        } else {
            args.push('-password', 'pass:');
        }

        const res = spawnSync('openssl', args, { stdio: 'inherit' });

        if (res.error) {
            throw new Error('OpenSSL command failed');
        }

        return Buffer.from(await readFile(p12Path));
    } finally {
        for (const path of paths) {
            try {
                await unlink(path);
            } catch (err) {
                console.error(err);
            }
        }
    }
}

/**
 * Generates a PKCS#12 (PFX) for only the truststore information
 * Relies on OpenSSL being available on the system.
 *
 * @param auth     - The connection authentication details containing key, cert, and optional CA certificates.
 * @param name     - The friendly name for the PKCS#12 entry.
 * @param password - Optional password to protect the PKCS#12 file. Defaults to an
 * @returns Buffer containing the PKCS#12 data.
 */
export async function generateTrustP12(
    auth: Static<typeof ConnectionAuth>,
    name: string,
    password: string = '',
): Promise<Buffer> {
    const tmp = tmpdir();
    const rand = randomBytes(8).toString('hex');
    const p12Path = join(tmp, `out-${rand}.p12`);

    const paths = [p12Path];

    if (!auth.ca || !auth.ca.length) {
        throw new Error('No CA certificates provided for trust store generation');
    }

    const output = [];

    for (const cert of auth.ca) {
        try {
            const x509 = new X509Certificate(Buffer.from(cert, 'base64'));
            output.push(x509.toString());
        } catch (err) {
            console.error('Invalid CA certificate provided, skipping:', err);
        }
    }

    const caPath = join(tmp, `key-${rand}.crt`);
    paths.push(caPath);
    await writeFile(caPath, output.join('\n'), { encoding: 'utf8' });

    try {
        const args = [
            'pkcs12',
            '-legacy',
            '-export',
            '-nokeys',
            '-in', caPath,
            '-out', p12Path,
            '-name', name,
        ];

        if (password) {
            args.push('-passout', `pass:${password}`);
        } else {
            args.push('-passout', 'pass:');
        }

        const res = spawnSync('openssl', args, { stdio: 'inherit' });

        if (res.error) {
            throw new Error('OpenSSL command failed');
        }

        return Buffer.from(await readFile(p12Path));
    } finally {
        for (const path of paths) {
            try {
                await unlink(path);
            } catch (err) {
                console.error(err);
            }
        }
    }
}
