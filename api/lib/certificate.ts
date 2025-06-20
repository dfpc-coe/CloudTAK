import { spawnSync } from "child_process";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";

/**
 * Generates a PKCS#12 (PFX) file as a Buffer from PEM-encoded private key and certificate.
 * Relies on OpenSSL being available on the system.
 *
 * @param key   - The PEM-encoded private key string.
 * @param cert  - The PEM-encoded certificate string.
 * @returns Buffer containing the PKCS#12 data.
 */
export async function generateP12(
    key: string,
    cert: string,
    password: string = ''
): Promise<Buffer> {
    const tmp = tmpdir();
    const rand = randomBytes(8).toString("hex");
    const keyPath = join(tmp, `key-${rand}.pem`);
    const certPath = join(tmp, `cert-${rand}.pem`);
    const p12Path = join(tmp, `out-${rand}.p12`);

    try {
        await writeFile(keyPath, key, { encoding: 'utf8' });
        await writeFile(certPath, cert, { encoding: 'utf8' });

        const args = [
            'pkcs12',
            '-legacy',
            '-export',
            '-out', p12Path,
            '-inkey', keyPath,
            '-in', certPath,
        ];

        if (password) {
            args.push("-password", `pass:${password}`);
        } else {
            args.push("-nodes", "-password", "pass:");
        }

        const res = spawnSync("openssl", args, { stdio: "inherit" });

        if (res.error) {
            throw new Error("OpenSSL command failed");
        }

        return Buffer.from(await readFile(p12Path));
    } finally {
        for (const path of [ keyPath, certPath, p12Path ]) {
            try {
                await unlink(path);
            } catch (err) {
                console.error(err);
            }
        }
    }
}
