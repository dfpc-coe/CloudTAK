import { describe, expect, it } from 'vitest';
import { connectionState, RECONNECT_GRACE_MS } from './connection-state.ts';

const base = { paused: false, isOpen: false, isOnline: true, closedAt: 1_000_000, now: 1_000_000 };

describe('connectionState', () => {
    it('is connected when the connection is open', () => {
        expect(connectionState({ ...base, isOpen: true })).toBe('connected');
    });

    it('is reconnecting when it just closed and the device is online', () => {
        expect(connectionState(base)).toBe('reconnecting');
        expect(connectionState({ ...base, now: base.closedAt + RECONNECT_GRACE_MS })).toBe('reconnecting');
    });

    it('is reconnecting while the first connection is still being made', () => {
        expect(connectionState({ ...base, closedAt: null })).toBe('reconnecting');
    });

    it('is disconnected when reconnecting has taken longer than the grace period', () => {
        expect(connectionState({ ...base, now: base.closedAt + RECONNECT_GRACE_MS + 1 })).toBe('disconnected');
    });

    it('is disconnected when the device is offline', () => {
        expect(connectionState({ ...base, isOnline: false })).toBe('disconnected');
    });

    it('paused wins over everything else', () => {
        expect(connectionState({ ...base, paused: true })).toBe('paused');
        expect(connectionState({ ...base, paused: true, isOpen: true })).toBe('paused');
        expect(connectionState({ ...base, paused: true, isOnline: false })).toBe('paused');
    });
});
