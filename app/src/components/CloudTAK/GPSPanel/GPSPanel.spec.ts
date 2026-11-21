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

const device = reactive({
    permissions: { orientation: 'granted' as string },
    hasPermissionRequest: false,
    hasOrientationPermissionRequest: () => device.hasPermissionRequest,
    requestOrientationPermission: vi.fn()
});

vi.mock('../../../stores/device.ts', () => ({
    useDeviceStore: () => device
}));

const sharing = reactive({
    paused: false,
    standby: false,
    standbyBy: null as string | null,
    broadcastKnown: false,
    busy: false
});
vi.mock('../../../stores/sharing.ts', () => ({
    useSharingStore: () => sharing
}));

let native = false;
vi.mock('../../../utils/capacitor.ts', () => ({
    isNativePlatform: () => native
}));

import GPSPanel from './GPSPanel.vue';

function mountPanel(mode = 'Default') {
    return mount(GPSPanel, {
        props: { mode },
        global: {
            stubs: { GPSPanelCoordinates: true, SharingToggle: true, BroadcastChip: true }
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
        expect(wrapper.find('[data-test="heading-source"]').exists()).toBe(false);
        expect(wrapper.find('[data-test="heading-request"]').exists()).toBe(false);
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
        expect(wrapper.find('[data-test="heading-source"]').text()).toContain('COG');

        store.speedUnit = 'm/s';
        await wrapper.vm.$nextTick();
        expect(wrapper.find('[data-test="speed"]').text()).toBe('10 m/s');

        store.distanceUnit = 'mile';
        store.elevationUnit = 'feet';
        store.speedUnit = 'mi/h';
        store.gpsSpeed = 0;
        store.deviceHeading = 154;
    });

    it('labels the GPS course as COG only when the compass heading is missing', async () => {
        store.deviceHeading = null;
        const wrapper = mountPanel();
        const label = wrapper.find('[data-test="heading-source"]');
        expect(label.text()).toContain('COG');
        expect(label.attributes('title')).toContain('Course over ground');
        expect(wrapper.find('[data-test="heading"]').text()).toBe('90°');

        store.deviceHeading = 154;
        await wrapper.vm.$nextTick();
        expect(wrapper.find('[data-test="heading-source"]').exists()).toBe(false);
        expect(wrapper.find('[data-test="heading"]').text()).toBe('154°');
    });

    it('shows --° without a heading and is not tappable when no permission request exists', () => {
        store.deviceHeading = null;
        store.gpsHeading = null;
        const wrapper = mountPanel();
        expect(wrapper.find('[data-test="heading"]').text()).toBe('--°');
        expect(wrapper.find('[data-test="heading-source"]').exists()).toBe(false);
        expect(wrapper.find('[data-test="heading-request"]').exists()).toBe(false);
        store.deviceHeading = 154;
        store.gpsHeading = 90;
    });

    it('requests orientation permission when tapped with no heading', async () => {
        store.deviceHeading = null;
        store.gpsHeading = null;
        device.hasPermissionRequest = true;
        device.permissions.orientation = 'prompt';
        const wrapper = mountPanel();
        const button = wrapper.find('button[data-test="heading-request"]');
        expect(button.exists()).toBe(true);
        expect(button.attributes('aria-label')).toContain('enable motion sensors');
        expect(button.find('[data-test="heading"]').text()).toBe('--°');

        await button.trigger('click');
        expect(device.requestOrientationPermission).toHaveBeenCalledTimes(1);
        // Tapping the heading must not also zoom to the location
        expect(wrapper.emitted('to-location')).toBeUndefined();

        device.permissions.orientation = 'granted';
        await wrapper.vm.$nextTick();
        expect(wrapper.find('[data-test="heading-request"]').exists()).toBe(false);
        expect(wrapper.find('[data-test="heading"]').text()).toBe('--°');

        device.hasPermissionRequest = false;
        store.deviceHeading = 154;
        store.gpsHeading = 90;
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
    describe('broadcast state', () => {
        it('shows nothing about broadcasting until the server reports a state', () => {
            sharing.broadcastKnown = false;
            native = false;
            const wrapper = mountPanel();
            expect(wrapper.find('[data-test="broadcast-status"]').exists()).toBe(false);
        });

        it('web: shows a status icon, live then standby', async () => {
            native = false;
            sharing.broadcastKnown = true;
            sharing.standby = false;
            const wrapper = mountPanel();
            const icon = wrapper.find('[data-test="broadcast-status"]');
            expect(icon.exists()).toBe(true);
            expect(icon.attributes('title')).toBe('This browser is sharing your location');
            sharing.standby = true;
            await wrapper.vm.$nextTick();
            expect(wrapper.find('[data-test="broadcast-status"]').attributes('title')).toBe('Another device is sharing your location');
            sharing.broadcastKnown = false;
            sharing.standby = false;
        });

        it('web: says nothing about sharing when there is no position to share', () => {
            native = false;
            sharing.broadcastKnown = true;
            sharing.standby = false;
            const previous = store.location;
            store.location = LocationState.Disabled;
            const wrapper = mountPanel();
            expect(wrapper.find('[data-test="broadcast-status"]').exists()).toBe(false);
            store.location = previous;
            sharing.broadcastKnown = false;
        });

        it('native: the status icon is left to the pause toggle', () => {
            native = true;
            sharing.broadcastKnown = true;
            const wrapper = mountPanel();
            expect(wrapper.find('[data-test="broadcast-status"]').exists()).toBe(false);
            expect(wrapper.find('[data-test="sharing-toggle"]').exists()).toBe(true);
            sharing.broadcastKnown = false;
            native = false;
        });
    });
});
