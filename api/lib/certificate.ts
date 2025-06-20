import { spawnSync } from "child_process";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
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
    keyPem: string,
    certPem: string,
    password: string = ''
): Buffer {
    const tmp = tmpdir();
    const rand = randomBytes(8).toString("hex");
    const keyPath = join(tmp, `key-${rand}.pem`);
    const certPath = join(tmp, `cert-${rand}.pem`);
    const p12Path = join(tmp, `out-${rand}.p12`);

    try {
        await writeFile(keyPath, keyPem, { encoding: "utf8" });
        await writeFile(certPath, certPem, { encoding: "utf8" });

        const args = [
            "pkcs12",
            "-export",
            "-inkey",
            keyPath,
            "-in",
            certPath,
            "-out",
            p12Path,
        ];

        if (password) {
            args.push("-password", `pass:${password}`);
        } else {
            args.push("-nodes", "-password", "pass:");
        }

        const res = spawnSync("openssl", args, { stdio: "inherit" });
        if (res.status !== 0) {
            throw new Error("OpenSSL command failed");
        }

        const p12Buf = Buffer.from(require("fs").readFileSync(p12Path));
        return p12Buf;
    } finally {
        [keyPath, certPath, p12Path].forEach((f) => {
            try {
                await unlink(f);
            } catch {}
        });
    }
}
