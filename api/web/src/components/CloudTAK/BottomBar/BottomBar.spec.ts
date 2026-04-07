import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../stores/map.ts', () => ({
    useMapStore: () => ({
        get bottomBar() {
            throw new Error('BottomBar Manager has not yet initialized');
        }
    })
}));

import BottomBar from './BottomBar.vue';

describe('BottomBar', () => {
    it('mounts safely before the bottom bar manager is initialized', () => {
        expect(() => {
            mount(BottomBar, {
                props: {
                    mode: 'standard',
                    mouseCoord: null
                },
                global: {
                    stubs: {
                        BottomBarCallsign: true,
                        BottomBarCoordinates: true
                    }
                }
            });
        }).not.toThrow();
    });
});
