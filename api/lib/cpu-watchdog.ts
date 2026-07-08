import os from 'node:os';
import { Readable } from 'node:stream';
import * as pprof from '@datadog/pprof';
import S3 from './aws/s3.js';
import type Config from './config.js';

const CPU_THRESHOLD = 0.8; // Trigger when host CPU exceeds 80%
const SAMPLE_INTERVAL_MS = 5_000; // Re-check host CPU every 5s
const PROFILE_DURATION_MS = 60_000; // Capture a 60s CPU profile
const COOLDOWN_MS = 15 * 60_000; // Pause the watchdog for 15min after a run

type CpuSample = {
    idle: number;
    total: number;
};

/**
 * Aggregate idle/total CPU tick counts across every core so usage can be
 * derived from the delta between two samples.
 */
function sampleCpu(): CpuSample {
    let idle = 0;
    let total = 0;

    for (const cpu of os.cpus()) {
        for (const value of Object.values(cpu.times)) total += value;
        idle += cpu.times.idle;
    }

    return { idle, total };
}

/**
 * Monitors host CPU usage and, when it spikes above the threshold, captures a
 * CPU profile with @datadog/pprof, uploads it to the asset bucket, and then
 * pauses itself for a cooldown window before it can trigger again.
 */
export default class CpuWatchdog {
    #config: Config;
    #timer?: NodeJS.Timeout;
    #last: CpuSample;
    #profiling = false;
    #disabledUntil = 0;

    constructor(config: Config) {
        this.#config = config;
        this.#last = sampleCpu();
    }

    start(): void {
        if (this.#timer) return;

        this.#timer = setInterval(() => {
            this.#tick().catch((err) => {
                console.error('CpuWatchdog: tick failed:', err instanceof Error ? err.message : String(err));
            });
        }, SAMPLE_INTERVAL_MS);

        // Don't keep the process alive solely for the watchdog timer
        this.#timer.unref();
    }

    stop(): void {
        if (!this.#timer) return;
        clearInterval(this.#timer);
        this.#timer = undefined;
    }

    async #tick(): Promise<void> {
        const current = sampleCpu();
        const idleDelta = current.idle - this.#last.idle;
        const totalDelta = current.total - this.#last.total;
        this.#last = current;

        // Skip evaluation while a capture is running or during the cooldown,
        // and guard against a zero/negative window (e.g. counter wrap).
        if (this.#profiling) return;
        if (Date.now() < this.#disabledUntil) return;
        if (totalDelta <= 0) return;

        const usage = 1 - idleDelta / totalDelta;
        if (usage < CPU_THRESHOLD) return;

        await this.#capture(usage);
    }

    async #capture(usage: number): Promise<void> {
        this.#profiling = true;

        const startedAt = new Date();
        console.error(`CpuWatchdog: host CPU ${(usage * 100).toFixed(1)}% exceeded ${CPU_THRESHOLD * 100}% - capturing ${PROFILE_DURATION_MS / 1000}s CPU profile`);

        try {
            const profile = await pprof.time.profile({
                durationMillis: PROFILE_DURATION_MS,
            });

            const buffer = await pprof.encode(profile);

            const key = `profiling/${this.#config.StackName}/cpu-${startedAt.toISOString().replace(/[:.]/g, '-')}.pb.gz`;

            await S3.put(key, Readable.from([buffer], { objectMode: false }));

            console.error(`CpuWatchdog: uploaded profile to s3://${this.#config.Bucket}/${key}`);
        } catch (err) {
            console.error('CpuWatchdog: failed to capture or upload profile:', err instanceof Error ? err.message : String(err));
        } finally {
            this.#profiling = false;

            // Begin the cooldown once the run completes so the watchdog stays
            // disabled for the full window afterwards.
            this.#disabledUntil = Date.now() + COOLDOWN_MS;

            // Reset the baseline so the next sample isn't skewed by profiling work
            this.#last = sampleCpu();

            console.error(`CpuWatchdog: paused for ${COOLDOWN_MS / 60_000}min`);
        }
    }
}
