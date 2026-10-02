import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { reactive } from 'vue';
import { LocationState } from '../../../utils/events.ts';
import { DrawToolMode } from '../../../stores/modules/draw.ts';

const store = reactive({
    draw: { mode: DrawToolMode.STATIC },
    callsign: 'COTAK Admin Buttlar',
    location: LocationState.Live,
    locationAccuracy: 3 as number | undefined,
    manualLocationMode: false,
    distanceUnit: 'mile',
    elevationUnit: 'feet',
    speedUnit: 'mi/h',
    gpsAltitude: 1728 as number | null,
    gpsSpeed: 0 as number | null,
    gpsHeading: 90 as number | null,
    deviceHeading: 154 as number | null
});

vi.mock('../../../stores/map.ts', () => ({
    useMapStore: () => store
}));

const appStore = reactive({ isMobileDetected: false });

vi.mock('../../../stores/app.ts', () => ({
    useAppStore: () => appStore
}));

import GPSPanel from './GPSPanel.vue';

function mountPanel(mode = 'Default') {
    return mount(GPSPanel, {
        props: { mode },
        global: {
            stubs: { GPSPanelCoordinates: true }
        }
    });
}

describe('GPSPanel', () => {
    it('stacks callsign, altitude, accuracy, speed and heading', () => {
        const wrapper = mountPanel();

        expect(wrapper.text()).toContain('COTAK Admin Buttlar');
        expect(wrapper.find('[data-test="altitude"]').text()).toBe('5669 ft MSL');
        expect(wrapper.find('[data-test="accuracy"]').text()).toBe('+/- 10 ft');
        expect(wrapper.find('[data-test="speed"]').text()).toBe('0 MPH');
        expect(wrapper.find('[data-test="heading"]').text()).toBe('154°');
    });

    it('follows the elevation, distance and speed profile settings', async () => {
        store.distanceUnit = 'meter';
        store.elevationUnit = 'meter';
        store.speedUnit = 'km/h';
        store.gpsSpeed = 10;
        store.deviceHeading = null;

        const wrapper = mountPanel();

        expect(wrapper.find('[data-test="altitude"]').text()).toBe('1728 m MSL');
        expect(wrapper.find('[data-test="accuracy"]').text()).toBe('+/- 3 m');
        expect(wrapper.find('[data-test="speed"]').text()).toBe('36 km/h');
        expect(wrapper.find('[data-test="heading"]').text()).toBe('90°');

        store.speedUnit = 'm/s';
        await wrapper.vm.$nextTick();
        expect(wrapper.find('[data-test="speed"]').text()).toBe('10 m/s');

        store.distanceUnit = 'mile';
        store.elevationUnit = 'feet';
        store.speedUnit = 'mi/h';
        store.gpsSpeed = 0;
        store.deviceHeading = 154;
    });

    it('shows placeholders without a live fix', () => {
        store.location = LocationState.Preset;

        const wrapper = mountPanel();

        expect(wrapper.find('[data-test="altitude"]').text()).toBe('-- ft MSL');
        expect(wrapper.find('[data-test="accuracy"]').text()).toBe('Manual');
        expect(wrapper.find('[data-test="speed"]').text()).toBe('-- MPH');

        store.location = LocationState.Live;
    });

    it('emits location events', async () => {
        const wrapper = mountPanel();

        await wrapper.find('.fw-semibold').trigger('click');
        expect(wrapper.emitted('to-location')).toHaveLength(1);

        await wrapper.find('[data-test="speed"]').trigger('click');
        expect(wrapper.emitted('to-location')).toHaveLength(2);

        await wrapper.find('[data-test="set-location"]').trigger('click');
        expect(wrapper.emitted('set-location')).toHaveLength(1);
        expect(wrapper.emitted('to-location')).toHaveLength(2);
    });

    it('hides on mobile while setting location', () => {
        appStore.isMobileDetected = true;

        expect(mountPanel('SetLocation').find('.gps-panel').exists()).toBe(false);
        expect(mountPanel('Default').find('.gps-panel').exists()).toBe(true);

        appStore.isMobileDetected = false;

        expect(mountPanel('SetLocation').find('.gps-panel').exists()).toBe(true);
    });

    it('hides on mobile while the draw tools are active', () => {
        appStore.isMobileDetected = true;
        store.draw.mode = DrawToolMode.POINT;

        expect(mountPanel('Default').find('.gps-panel').exists()).toBe(false);

        appStore.isMobileDetected = false;

        expect(mountPanel('Default').find('.gps-panel').exists()).toBe(true);

        store.draw.mode = DrawToolMode.STATIC;
    });
});
