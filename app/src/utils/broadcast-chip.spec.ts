import { describe, expect, it } from 'vitest';
import { broadcastChipMode } from './broadcast-chip.ts';

describe('broadcastChipMode', () => {
    it('is hidden while this session is the broadcaster', () => {
        expect(broadcastChipMode({ paused: false, standby: false, broadcastKnown: true })).toBeNull();
    });

    it('paused wins, whatever the server says', () => {
        expect(broadcastChipMode({ paused: true, standby: false, broadcastKnown: false })).toBe('paused');
        expect(broadcastChipMode({ paused: true, standby: true, broadcastKnown: true })).toBe('paused');
    });

    it('standby needs the server to have reported a state', () => {
        expect(broadcastChipMode({ paused: false, standby: true, broadcastKnown: false })).toBeNull();
        expect(broadcastChipMode({ paused: false, standby: true, broadcastKnown: true })).toBe('standby');
    });
});
