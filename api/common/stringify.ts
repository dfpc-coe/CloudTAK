import { inspect } from 'node:util';
import type { RawData } from 'ws';

/**
 * Stringify a value of unknown shape without falling back to `[object Object]`
 */
export function stringify(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return String(value);
    if (typeof value === 'object' && value !== null) return inspect(value);
    return String(value);
}

/**
 * Decode a WebSocket message payload as UTF-8 text
 */
export function rawDataToString(data: RawData): string {
    if (Array.isArray(data)) return Buffer.concat(data).toString();
    if (data instanceof ArrayBuffer) return Buffer.from(data).toString();
    return data.toString();
}
