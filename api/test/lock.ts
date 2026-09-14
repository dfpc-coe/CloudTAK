import fs from 'node:fs';

const sleeper = new Int32Array(new SharedArrayBuffer(4));

/**
 * Run fn while holding an exclusive cross-process lock
 *
 * Parallel test workers share the generated certificates under /tmp, so
 * their creation must be serialized. mkdir is atomic on every platform,
 * which makes a directory a dependable mutex for synchronous code
 */
export default function withFileLock<T>(name: string, fn: () => T): T {
    const dir = `/tmp/cloudtak-test-${name}.lock`;
    const deadline = Date.now() + 120_000;

    for (;;) {
        try {
            fs.mkdirSync(dir);
            break;
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;

            try {
                // Left behind by a process that died while holding the lock
                if (Date.now() - fs.statSync(dir).mtimeMs > 60_000) fs.rmdirSync(dir);
            } catch {
                // Another waiter removed it first
            }

            if (Date.now() > deadline) throw new Error(`Timed out waiting for ${dir}`, { cause: err });

            Atomics.wait(sleeper, 0, 0, 50);
        }
    }

    try {
        return fn();
    } finally {
        try {
            fs.rmdirSync(dir);
        } catch {
            // Reclaimed as stale by another waiter
        }
    }
}
