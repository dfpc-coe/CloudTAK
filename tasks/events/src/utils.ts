import cp from 'node:child_process';
import fs from 'node:fs';
import readline from 'node:readline';

/**
 * Run a command synchronously, surfacing the child's stderr, exit code and
 * signal on failure - execFileSync's default error discards all of them
 *
 * @param command Executable to run
 * @param args Arguments to pass to the executable
 * @param opts Options passed through to execFileSync
 * @returns The command's stdout
 */
export function run(
    command: string,
    args: string[],
    opts: cp.ExecFileSyncOptions = {},
): string {
    try {
        return cp.execFileSync(command, args, { maxBuffer: 100 * 1024 * 1024, ...opts }).toString();
    } catch (err) {
        const e = err as Error & cp.SpawnSyncReturns<Buffer>;
        const stderr = e.stderr ? String(e.stderr).trim().slice(-2000) : '';
        const detail = e.signal ? `killed by signal ${e.signal}` : `exit code ${e.status}`;
        throw new Error(`${command} ${args.slice(0, 2).join(' ')} failed (${detail})${stderr ? `: ${stderr}` : ''}`, { cause: err });
    }
}

/**
 * Count the number of features in a line-delimited GeoJSON file
 * @param filePath Path to the .geojsonld file
 * @returns Number of features
 */
export async function countFeatures(filePath: string): Promise<number> {
    let count = 0;
    const readStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: readStream,
        crlfDelay: Infinity,
    });

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const feat = JSON.parse(line);
            if (feat.type === 'Feature' || feat.type === 'FeatureCollection') {
                count++;
            }
        } catch {
            // Skip invalid lines
        }
    }

    return count;
}
