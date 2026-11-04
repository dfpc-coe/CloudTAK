import type { InputFeature } from '../types.ts';

/** ATAK QuickPicReceiver marker type */
export const QUICK_PIC_TYPE = 'b-i-x-i';

export function quickPicName(date: Date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');

    return `QuickPic-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
        + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function quickPicFeature(opts: {
    id: string;
    hash: string;
    callsign: string;
    coordinates: [number, number];
    altitude?: number | null;
    date?: Date;
}): InputFeature {
    const now = (opts.date ?? new Date()).toISOString();

    const coordinates: number[] = [
        Math.round(opts.coordinates[0] * 1000000) / 1000000,
        Math.round(opts.coordinates[1] * 1000000) / 1000000,
    ];

    if (typeof opts.altitude === 'number' && Number.isFinite(opts.altitude)) {
        coordinates.push(Math.round(opts.altitude * 10) / 10);
    }

    return {
        id: opts.id,
        type: 'Feature',
        path: '/',
        properties: {
            id: opts.id,
            type: QUICK_PIC_TYPE,
            how: 'h-g-i-g-o',
            archived: true,
            time: now,
            start: now,
            stale: now,
            center: coordinates,
            callsign: opts.callsign,
            attachments: [opts.hash],
        },
        geometry: {
            type: 'Point',
            coordinates
        }
    };
}
