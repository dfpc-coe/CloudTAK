import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const GET = vi.fn();

vi.mock('../../../std.ts', () => ({
    server: { GET: (...args: unknown[]) => GET(...args) }
}));

import Sun from './Sun.vue';

// Reported scenario: viewer on US Pacific time at 2026-08-22T23:36Z querying the South Island of NZ
const NOW = new Date('2026-08-22T23:36:00Z');

const sun = {
    sunrise: '2026-08-22T19:23:04.154Z',
    sunriseEnd: null,
    goldenHourEnd: null,
    solarNoon: '2026-08-23T00:42:59.989Z',
    goldenHour: null,
    sunsetStart: null,
    sunset: '2026-08-23T06:03:31.868Z',
    dusk: '2026-08-23T06:32:00.000Z',
    nauticalDusk: null,
    night: null,
    nadir: '2026-08-22T12:42:59.989Z',
    nightEnd: null,
    nauticalDawn: null,
    dawn: '2026-08-22T18:53:00.000Z',
    timezone: 'Pacific/Auckland' as string | null,
};

async function mountSun(timezone: string | null) {
    GET.mockResolvedValue({ data: { sun: { ...sun, timezone } }, error: undefined });

    const wrapper = mount(Sun, {
        props: { longitude: 169.9446811687917, latitude: -43.48239455544271 },
        global: { stubs: { TablerLoading: true, TablerAlert: true } }
    });

    await flushPromises();

    return wrapper;
}

describe('Query/Sun', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });

    afterEach(() => {
        vi.useRealTimers();
        GET.mockReset();
    });

    it('renders times in the location timezone, not the viewer timezone', async () => {
        const wrapper = await mountSun('Pacific/Auckland');
        const text = wrapper.text();

        expect(text).toContain('07:23');
        expect(text).toContain('12:42');
        expect(text).toContain('18:03');
        expect(text).toMatch(/NZST|GMT\+12/);

        expect(text).not.toContain('12:24');
        expect(text).not.toContain('17:43');
        expect(text).not.toContain('23:02');
    });

    it('places the current time marker between sunrise and solar noon', async () => {
        const wrapper = await mountSun('Pacific/Auckland');
        const text = wrapper.text();

        expect(text.indexOf('Sunrise')).toBeLessThan(text.indexOf('Current Time'));
        expect(text.indexOf('Current Time')).toBeLessThan(text.indexOf('Solar Noon'));
        expect(text.indexOf('Current Time')).toBeLessThan(text.indexOf('Sunset'));
    });

    it('falls back to UTC when no timezone is resolved', async () => {
        const wrapper = await mountSun(null);
        const text = wrapper.text();

        expect(text).toContain('19:23');
        expect(text).toContain('00:42');
        expect(text).toContain('UTC');
    });

    it('falls back to UTC when the browser does not recognise the timezone', async () => {
        const wrapper = await mountSun('Not/AZone');
        const text = wrapper.text();

        expect(text).toContain('19:23');
        expect(text).toContain('UTC');
    });
});
