import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Map as MapLibreMap } from 'maplibre-gl';

import { CameraFollower, shortestRotation, smoothingFactor } from './camera-follower.ts';

describe('shortestRotation', () => {
    it('crosses north the short way', () => {
        expect(shortestRotation(350, 10)).toBe(20);
        expect(shortestRotation(10, 350)).toBe(-20);
        expect(shortestRotation(-170, 170)).toBe(-20);
    });

    it('handles aligned and opposite headings', () => {
        expect(shortestRotation(90, 90)).toBe(0);
        expect(shortestRotation(0, 180)).toBe(180);
        expect(shortestRotation(180, 0)).toBe(180);
    });
});

describe('smoothingFactor', () => {
    it('is frame rate independent', () => {
        const once = 1 - smoothingFactor(32);
        const twice = (1 - smoothingFactor(16)) ** 2;
        expect(once).toBeCloseTo(twice, 10);
    });

    it('does not move without elapsed time', () => {
        expect(smoothingFactor(0)).toBe(0);
    });
});

describe('CameraFollower', () => {
    let frames: Array<(now: number) => void>;
    let now: number;

    function fakeMap(bearing: number) {
        const state = { bearing, center: { lng: 0, lat: 0 }, moving: false, jumps: 0 };
        const map = {
            getBearing: () => state.bearing,
            getCenter: () => state.center,
            isMoving: () => state.moving,
            project: (c: { lng: number; lat: number }) => ({
                dist: () => Math.hypot(c.lng - state.center.lng, c.lat - state.center.lat) * 1000
            }),
            jumpTo: (opts: { bearing?: number; center?: { lng: number; lat: number } }) => {
                state.jumps++;
                if (opts.bearing !== undefined) state.bearing = opts.bearing;
                if (opts.center) state.center = opts.center;
            }
        };
        return { state, map: map as unknown as MapLibreMap };
    }

    function run(max = 600): number {
        let count = 0;
        while (frames.length && count < max) {
            now += 16;
            frames.shift()!(now);
            count++;
        }
        return count;
    }

    beforeEach(() => {
        frames = [];
        now = 1000;
        vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => frames.push(cb));
        vi.stubGlobal('cancelAnimationFrame', () => { frames = []; });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('glides to the heading over several frames and then idles', () => {
        const { state, map } = fakeMap(350);
        const follower = new CameraFollower(map);

        follower.setBearing(10);
        now += 16;
        frames.shift()!(now);
        expect(state.bearing).toBeGreaterThan(350);
        expect(state.bearing).toBeLessThan(360);

        const count = run();
        expect(count).toBeGreaterThan(10);
        expect(count).toBeLessThan(600);
        expect(shortestRotation(state.bearing, 10)).toBeCloseTo(0, 5);
        expect(frames.length).toBe(0);
    });

    it('leaves the camera alone while a gesture is moving it', () => {
        const { state, map } = fakeMap(0);
        const follower = new CameraFollower(map);

        state.moving = true;
        follower.setBearing(90);
        follower.setCenter({ lng: 1, lat: 1 });
        run(5);
        expect(state.jumps).toBe(0);

        state.moving = false;
        run();
        expect(state.bearing).toBeCloseTo(90, 5);
        expect(state.center).toEqual({ lng: 0, lat: 0 });
    });

    it('eases the centre alongside the bearing', () => {
        const { state, map } = fakeMap(0);
        const follower = new CameraFollower(map);

        follower.setBearing(45);
        follower.setCenter({ lng: 0.01, lat: -0.01 });
        run();

        expect(state.bearing).toBeCloseTo(45, 5);
        expect(state.center).toEqual({ lng: 0.01, lat: -0.01 });
    });

    it('stops on request', () => {
        const { state, map } = fakeMap(0);
        const follower = new CameraFollower(map);

        follower.setBearing(90);
        follower.stop();
        run();
        expect(state.jumps).toBe(0);
    });
});
