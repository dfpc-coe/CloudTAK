import { describe, expect, it } from 'vitest';
import { connectionState, RECONNECT_GRACE_MS } from './connection-state.ts';

const base = { isOpen: false, isOnline: true, closedAt: 1000, now: 1000 };

describe('connectionState', () => {
    it('is connected whenever the socket is open', () => {
        expect(connectionState({ ...base, isOpen: true, isOnline: false })).toBe('connected');
    });

    it('is disconnected when the device is offline', () => {
        expect(connectionState({ ...base, isOnline: false })).toBe('disconnected');
    });

    it('is reconnecting inside the grace period', () => {
        expect(connectionState({ ...base, now: 1000 + RECONNECT_GRACE_MS })).toBe('reconnecting');
    });

    it('is disconnected once the grace period passes', () => {
        expect(connectionState({ ...base, now: 1001 + RECONNECT_GRACE_MS })).toBe('disconnected');
    });

    it('is reconnecting before any close has been recorded', () => {
        expect(connectionState({ ...base, closedAt: null, now: 10 * RECONNECT_GRACE_MS })).toBe('reconnecting');
    });
});
