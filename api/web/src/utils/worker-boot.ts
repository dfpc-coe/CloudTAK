/**
 * Session handed to a dedicated worker through `Worker.name`, readable
 * synchronously as `self.name` during module evaluation. The Atlas worker
 * used to resolve its server URL from IndexedDB at import time, which on
 * native could hang the worker before it ever signalled ready.
 */
export type WorkerBootConfig = {
    serverUrl?: string;
};

const PREFIX = 'cloudtak:';

export function serializeWorkerBootConfig(config: WorkerBootConfig): string {
    return PREFIX + JSON.stringify(config);
}

export function parseWorkerBootConfig(name: string | null | undefined): WorkerBootConfig | undefined {
    if (typeof name !== 'string' || !name.startsWith(PREFIX)) return undefined;

    try {
        const parsed: unknown = JSON.parse(name.slice(PREFIX.length));
        if (!parsed || typeof parsed !== 'object') return undefined;

        const serverUrl = (parsed as { serverUrl?: unknown }).serverUrl;

        return {
            serverUrl: typeof serverUrl === 'string' && serverUrl ? serverUrl : undefined
        };
    } catch {
        return undefined;
    }
}
