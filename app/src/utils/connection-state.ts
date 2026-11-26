export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

export const RECONNECT_GRACE_MS = 60_000;

export function connectionState(opts: {
    isOpen: boolean;
    isOnline: boolean;
    closedAt: number | null;
    now: number;
}): ConnectionState {
    if (opts.isOpen) return 'connected';
    if (!opts.isOnline) return 'disconnected';
    if (opts.closedAt !== null && opts.now - opts.closedAt > RECONNECT_GRACE_MS) return 'disconnected';
    return 'reconnecting';
}
