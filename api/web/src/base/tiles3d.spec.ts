import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../stores/map.ts', () => ({ useMapStore: vi.fn() }));
vi.mock('../std.ts', () => ({ server: {} }));
vi.mock('./overlay.ts', () => ({ default: {} }));

import { Tiles3DManager, exposeCameraTransform, formatAttribution, fixGlobalRegions, tilesFetch, GEOID_RESAMPLE_M, REFRESH_MS, AUTH_RETRY_GUARD_MS, SCHEDULE_RETRY_MS, type IonAccess } from './tiles3d.ts';

type Props = Record<string, unknown>;

function setup(opts: {
    layers?: string[];
    access?: (name: string, call: number) => IonAccess;
    camera?: { transform: unknown };
    geoid?: (lat: number, lng: number) => Promise<number>;
} = {}) {
    const existing = new Set(opts.layers ?? []);
    const listeners = new Set<() => unknown>();
    const map = {
        ...(opts.camera ? { _camera: opts.camera } : {}),
        addControl: vi.fn(),
        removeControl: vi.fn(),
        getLayer: (id: string) => existing.has(id) ? { id } : undefined,
        on: vi.fn((_type: 'moveend', listener: () => unknown) => { listeners.add(listener); }),
        off: vi.fn((_type: 'moveend', listener: () => unknown) => { listeners.delete(listener); }),
    };

    let center = { lng: 0, lat: 0 };
    const moveTo = async (lng: number, lat: number) => {
        center = { lng, lat };
        await Promise.all(Array.from(listeners, (listener) => listener()));
    };

    const overlays: Array<{ props: Props; setProps: (p: Props) => void; finalize: () => void }> = [];
    class MapboxOverlay {
        props: Props;
        constructor(props: Props) { this.props = props; overlays.push(this); }
        setProps(p: Props) { this.props = { ...this.props, ...p }; }
        finalize() {}
    }
    class Tile3DLayer {
        props: Props;
        constructor(props: Props) { this.props = props; }
    }
    const Tiles3DLoader = { name: 'fake-loader' };
    class Matrix4 {
        translation: number[] = [];
        translate(v: number[]) { this.translation = v; return this; }
    }

    let calls = 0;
    const fetchAccess = vi.fn(async (name: string): Promise<IonAccess> => {
        calls++;
        return opts.access ? opts.access(name, calls) : {
            url: `https://tiles/${name}/${calls}/tileset.json`,
            accessToken: `token-${calls}`,
            attributions: [{ text: `${name} credit` }],
        };
    });

    const geoid = vi.fn(opts.geoid ?? (async () => 30));

    let now = 0;
    const onChange = vi.fn();
    const manager = new Tiles3DManager({
        map,
        deck: { MapboxOverlay, Tile3DLayer, Tiles3DLoader, Matrix4 },
        fetchAccess,
        beforeId: () => 'cot-layer',
        center: () => center,
        geoid,
        now: () => now,
        onChange,
    });

    const layers = () => (overlays[0]?.props.layers ?? []) as Array<{ props: Props }>;

    const translation = (i = 0) => (layers()[i].props.loadOptions as { tileset: { modelMatrix: { translation: number[] } } }).tileset.modelMatrix.translation;

    return { manager, map, overlays, layers, translation, geoid, fetchAccess, onChange, existing, listeners, moveTo, setNow: (n: number) => { now = n; } };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('Tiles3DManager', () => {
    it('adds one interleaved overlay and one layer per entry', async () => {
        const t = setup({ layers: ['cot-layer'] });
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 0.8 });

        expect(t.map.addControl).toHaveBeenCalledTimes(1);
        expect(t.overlays[0].props.interleaved).toBe(true);
        expect(t.layers()).toHaveLength(1);

        const props = t.layers()[0].props;
        expect(props.id).toBe('tiles3d-7-0');
        expect(props.data).toBe('https://tiles/osm-buildings/1/tileset.json');
        expect(props.visible).toBe(true);
        expect(props.opacity).toBe(0.8);
        expect(props.beforeId).toBe('cot-layer');
        const loadOptions = props.loadOptions as { core: { fetch: unknown } };
        expect(typeof loadOptions.core.fetch).toBe('function');
        // lng 0, lat 0: local up is +X in ECEF
        expect(t.translation()[0]).toBeCloseTo(-30);
        expect(t.translation()[1]).toBeCloseTo(0);
        expect(t.translation()[2]).toBeCloseTo(0);
        expect(t.onChange).toHaveBeenCalled();
    });

    it('passes the access token to the tile fetch', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('x', { status: 200 }));
        const t = setup();
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });

        const { fetch } = (t.layers()[0].props.loadOptions as { core: { fetch: (url: string, init?: RequestInit) => Promise<Response> } }).core;
        await fetch('https://tiles/a.b3dm');

        expect(new Headers(fetchSpy.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer token-1');
        fetchSpy.mockRestore();
    });

    it('sends no Authorization header when access has no token', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('x', { status: 200 }));
        const t = setup({ access: () => ({ url: 'https://external/root.json?key=k', attributions: [] }) });
        await t.manager.add({ id: '8', name: 'external', visible: true, opacity: 1 });

        const { fetch } = (t.layers()[0].props.loadOptions as { core: { fetch: (url: string, init?: RequestInit) => Promise<Response> } }).core;
        await fetch('https://external/child.glb');

        expect(new Headers(fetchSpy.mock.calls[0][1]?.headers).has('Authorization')).toBe(false);
        fetchSpy.mockRestore();
    });

    it('resolves beforeId lazily and only to an existing layer', async () => {
        const t = setup();
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });
        expect(t.layers()[0].props.beforeId).toBeUndefined();

        t.existing.add('cot-layer');
        t.manager.render();
        expect(t.layers()[0].props.beforeId).toBe('cot-layer');
    });

    it('updates visibility and opacity without refetching', async () => {
        const t = setup();
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });

        t.manager.setVisible('7', false);
        t.manager.setOpacity('7', 0.3);

        expect(t.layers()[0].props.visible).toBe(false);
        expect(t.layers()[0].props.opacity).toBe(0.3);
        expect(t.fetchAccess).toHaveBeenCalledTimes(1);
    });

    it('removes a layer and its refresh timer', async () => {
        const t = setup();
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });
        t.manager.remove('7');

        expect(t.layers()).toHaveLength(0);
        await vi.advanceTimersByTimeAsync(REFRESH_MS);
        expect(t.fetchAccess).toHaveBeenCalledTimes(1);
    });

    it('refreshes after 50 minutes with a new layer id', async () => {
        const t = setup();
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });

        await vi.advanceTimersByTimeAsync(REFRESH_MS);

        expect(t.fetchAccess).toHaveBeenCalledTimes(2);
        expect(t.layers()[0].props.id).toBe('tiles3d-7-1');
        expect(t.fetchAccess).toHaveBeenCalledTimes(2);
    });

    it('re-arms the refresh timer after a scheduled refresh fails, so later refreshes still happen', async () => {
        const t = setup();
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });
        const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});

        t.fetchAccess.mockImplementationOnce(() => Promise.reject(new Error('network blip')));

        // The scheduled 50-minute refresh fires and fails
        await vi.advanceTimersByTimeAsync(REFRESH_MS);
        expect(t.fetchAccess).toHaveBeenCalledTimes(2);
        expect(t.layers()[0].props.id).toBe('tiles3d-7-0'); // failed refresh must not bump the generation

        // A failure must not leave the entry with no timer at all: it retries sooner
        await vi.advanceTimersByTimeAsync(SCHEDULE_RETRY_MS);
        expect(t.fetchAccess).toHaveBeenCalledTimes(3);
        expect(t.layers()[0].props.id).toBe('tiles3d-7-1');

        consoleErr.mockRestore();
    });

    it('does not re-arm the refresh timer for an entry removed while a scheduled refresh is failing', async () => {
        const t = setup();
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });
        const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});

        let reject: (err: Error) => void = () => {};
        t.fetchAccess.mockImplementationOnce(() => new Promise((_resolve, rej) => { reject = rej; }));

        // The scheduled 50-minute refresh fires and starts fetching...
        await vi.advanceTimersByTimeAsync(REFRESH_MS);
        expect(t.fetchAccess).toHaveBeenCalledTimes(2);

        // ...the overlay is removed before the fetch settles...
        t.manager.remove('7');
        reject(new Error('network blip'));
        await vi.advanceTimersByTimeAsync(0);

        // ...so no retry timer must have been armed for the (now gone) id
        await vi.advanceTimersByTimeAsync(SCHEDULE_RETRY_MS);
        expect(t.fetchAccess).toHaveBeenCalledTimes(2);

        consoleErr.mockRestore();
    });

    it('keeps exactly one timer per id when an old scheduled refresh fails after the id was removed and re-added', async () => {
        const t = setup();
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });
        const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});

        let reject: (err: Error) => void = () => {};
        t.fetchAccess.mockImplementationOnce(() => new Promise((_resolve, rej) => { reject = rej; }));

        // The scheduled 50-minute refresh fires and starts fetching...
        await vi.advanceTimersByTimeAsync(REFRESH_MS);
        expect(t.fetchAccess).toHaveBeenCalledTimes(2);

        // ...the id is removed and re-added while that old fetch is still in
        // flight, giving it a fresh state with its own legitimate timer...
        t.manager.remove('7');
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });
        expect(t.fetchAccess).toHaveBeenCalledTimes(3);

        // ...then the old, orphaned refresh finally rejects, arming a retry
        // timer on the *new* state.
        reject(new Error('network blip'));
        await vi.advanceTimersByTimeAsync(0);

        // The retry timer fires and refreshes exactly once.
        await vi.advanceTimersByTimeAsync(SCHEDULE_RETRY_MS);
        expect(t.fetchAccess).toHaveBeenCalledTimes(4);

        // If the new state's original (legitimate) timer had been leaked
        // instead of cleared before the retry timer overwrote it, it would
        // still be pending and would fire here too, at REFRESH_MS since the
        // re-add - producing a second, redundant refresh for the same id.
        await vi.advanceTimersByTimeAsync(REFRESH_MS - SCHEDULE_RETRY_MS);
        expect(t.fetchAccess).toHaveBeenCalledTimes(4);

        consoleErr.mockRestore();
    });

    it('does not re-arm the refresh timer once the manager is destroyed', async () => {
        const t = setup();
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });
        const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});

        let reject: (err: Error) => void = () => {};
        t.fetchAccess.mockImplementationOnce(() => new Promise((_resolve, rej) => { reject = rej; }));

        await vi.advanceTimersByTimeAsync(REFRESH_MS);
        expect(t.fetchAccess).toHaveBeenCalledTimes(2);

        t.manager.destroy();
        reject(new Error('network blip'));
        await vi.advanceTimersByTimeAsync(SCHEDULE_RETRY_MS);
        expect(t.fetchAccess).toHaveBeenCalledTimes(2);

        consoleErr.mockRestore();
    });

    it('refreshes once on a 401 tile error', async () => {
        const t = setup();
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });
        const onTileError = t.layers()[0].props.onTileError as (...args: unknown[]) => void;

        onTileError({}, 'https://tiles/x.b3dm', 'Failed to fetch: 401 Unauthorized');
        onTileError({}, 'https://tiles/y.b3dm', 'Failed to fetch: 401 Unauthorized');
        // Only flush the immediate (0ms) retry timer scheduled by onTileError: the
        // manager also holds the far-future 50-minute refresh timer at this point,
        // and runOnlyPendingTimersAsync() ticks the fake clock all the way to the
        // furthest pending timer, firing that one too.
        await vi.advanceTimersByTimeAsync(0);
        expect(t.fetchAccess).toHaveBeenCalledTimes(2);

        t.setNow(AUTH_RETRY_GUARD_MS);
        const next = t.layers()[0].props.onTileError as (...args: unknown[]) => void;
        next({}, 'https://tiles/z.b3dm', 'Failed to fetch: 401 Unauthorized');
        await vi.advanceTimersByTimeAsync(0);
        expect(t.fetchAccess).toHaveBeenCalledTimes(3);
    });

    it('ignores tile errors other than 401', async () => {
        const t = setup();
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });
        const onTileError = t.layers()[0].props.onTileError as (...args: unknown[]) => void;

        onTileError({}, 'https://tiles/x.b3dm', 'Failed to fetch: 500 Internal Server Error');
        await vi.advanceTimersByTimeAsync(0);
        expect(t.fetchAccess).toHaveBeenCalledTimes(1);
    });

    it('does not resurrect a layer removed during refresh', async () => {
        let release: () => void = () => {};
        const t = setup({
            access: (name, call) => ({ url: `https://tiles/${name}/${call}`, attributions: [] }),
        });
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });

        t.fetchAccess.mockImplementationOnce(() => new Promise((resolve) => {
            release = () => resolve({ url: 'https://tiles/late', attributions: [] });
        }));
        const pending = t.manager.refresh('7');
        t.manager.remove('7');
        release();
        await pending;

        expect(t.layers()).toHaveLength(0);
    });

    it('drops the result of add() when removed before the fetch resolves', async () => {
        let release: () => void = () => {};
        const t = setup();
        t.fetchAccess.mockImplementationOnce(() => new Promise((resolve) => {
            release = () => resolve({ url: 'https://tiles/late', attributions: [] });
        }));

        const pendingAdd = t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });
        t.manager.remove('7');
        release();
        await pendingAdd;

        expect(t.layers()).toHaveLength(0);
        expect(t.map.addControl).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(REFRESH_MS);
        expect(t.fetchAccess).toHaveBeenCalledTimes(1);
    });

    it('lets the most recently started add() win when two overlapping calls resolve out of order', async () => {
        const t = setup();
        let releaseFirst: () => void = () => {};
        let releaseSecond: () => void = () => {};

        t.fetchAccess.mockImplementationOnce(() => new Promise((resolve) => {
            releaseFirst = () => resolve({ url: 'https://tiles/first', attributions: [] });
        }));
        const first = t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });

        t.fetchAccess.mockImplementationOnce(() => new Promise((resolve) => {
            releaseSecond = () => resolve({ url: 'https://tiles/second', attributions: [] });
        }));
        const second = t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 0.5 });

        // The second call's fetch resolves first...
        releaseSecond();
        await second;
        expect(t.layers()[0].props.data).toBe('https://tiles/second');
        expect(t.layers()[0].props.opacity).toBe(0.5);

        // ...and the first call's late resolution must not overwrite it.
        releaseFirst();
        await first;
        expect(t.layers()).toHaveLength(1);
        expect(t.layers()[0].props.data).toBe('https://tiles/second');
        expect(t.layers()[0].props.opacity).toBe(0.5);
    });

    it('drops a pending add() when the manager is destroyed first', async () => {
        let release: () => void = () => {};
        const t = setup();
        t.fetchAccess.mockImplementationOnce(() => new Promise((resolve) => {
            release = () => resolve({ url: 'https://tiles/late', attributions: [] });
        }));

        const pendingAdd = t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });
        t.manager.destroy();
        release();
        await pendingAdd;

        expect(t.map.addControl).not.toHaveBeenCalled();
        expect(t.layers()).toHaveLength(0);
    });

    it('drops a pending refresh() when the manager is destroyed first', async () => {
        const t = setup();
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });
        t.onChange.mockClear();

        let release: () => void = () => {};
        t.fetchAccess.mockImplementationOnce(() => new Promise((resolve) => {
            release = () => resolve({ url: 'https://tiles/late', attributions: [] });
        }));

        const pendingRefresh = t.manager.refresh('7');
        t.manager.destroy();
        release();
        await pendingRefresh;

        expect(t.onChange).not.toHaveBeenCalled();
        expect(t.map.removeControl).toHaveBeenCalledTimes(1);

        // The dropped refresh must not have scheduled a new periodic timer
        await vi.advanceTimersByTimeAsync(REFRESH_MS);
        expect(t.fetchAccess).toHaveBeenCalledTimes(2);
    });

    it('lists attributions of visible layers without duplicates', async () => {
        const t = setup({
            access: (name) => ({ url: `https://tiles/${name}`, attributions: [{ text: 'Shared' }, { text: name }] }),
        });
        await t.manager.add({ id: '1', name: 'a', visible: true, opacity: 1 });
        await t.manager.add({ id: '2', name: 'b', visible: false, opacity: 1 });

        expect(t.manager.attributions()).toEqual([{ text: 'Shared' }, { text: 'a' }]);
    });

    it('reports whether any 3D layer is visible', async () => {
        const t = setup();
        expect(t.manager.hasVisible()).toBe(false);

        await t.manager.add({ id: '7', name: 'osm-buildings', visible: false, opacity: 1 });
        expect(t.manager.hasVisible()).toBe(false);

        t.manager.setVisible('7', true);
        expect(t.manager.hasVisible()).toBe(true);
    });

    it('destroy removes the overlay and stops timers', async () => {
        const t = setup();
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });
        t.manager.destroy();

        expect(t.map.removeControl).toHaveBeenCalledTimes(1);
        expect(t.listeners.size).toBe(0);
        await vi.advanceTimersByTimeAsync(REFRESH_MS);
        expect(t.fetchAccess).toHaveBeenCalledTimes(1);
    });

    it('exposes the MapLibre 6 camera transform to deck.gl before adding the overlay', async () => {
        const transform = { height: 720, elevation: 124 };
        const t = setup({ camera: { transform } });
        let seen: unknown;
        t.map.addControl.mockImplementation(() => { seen = (t.map as { transform?: unknown }).transform; });

        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });

        expect(seen).toBe(transform);
    });

    it('exposes isDestroyed so callers (e.g. getTiles3D()) can tell a manager was torn down', async () => {
        const t = setup();
        expect(t.manager.isDestroyed).toBe(false);

        t.manager.destroy();
        expect(t.manager.isDestroyed).toBe(true);
    });
});

describe('Tiles3DManager geoid shift', () => {
    it('looks up the undulation at the map center before drawing', async () => {
        const t = setup({ geoid: async (lat) => lat === 52 ? 31.29 : 0 });
        await t.moveTo(0, 52);
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });

        expect(t.geoid).toHaveBeenCalledWith(52, 0);

        const phi = 52 * Math.PI / 180;
        expect(t.translation()[0]).toBeCloseTo(-Math.cos(phi) * 31.29);
        expect(t.translation()[2]).toBeCloseTo(-Math.sin(phi) * 31.29);
    });

    it('draws without a shift when the lookup fails', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const t = setup({ geoid: async () => { throw new Error('500'); } });
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });

        expect(t.layers()).toHaveLength(1);
        expect(t.translation()).toEqual([-0, -0, -0]);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('does not look up the undulation again after a small move', async () => {
        const t = setup();
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });

        // ~11 km east
        await t.moveTo(0.1, 0);

        expect(t.geoid).toHaveBeenCalledTimes(1);
        expect(t.layers()[0].props.id).toBe('tiles3d-7-0');
    });

    it('keeps the tileset when the undulation barely changes after a long move', async () => {
        let undulation = 30;
        const t = setup({ geoid: async () => undulation });
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });

        undulation = 30.5;
        // ~111 km east: the up vector turns by ~0.5 m at 30 m, 0.7 m in total
        await t.moveTo(1, 0);

        expect(t.geoid).toHaveBeenCalledTimes(2);
        expect(t.layers()[0].props.id).toBe('tiles3d-7-0');
    });

    it('reloads the tileset with a new shift after a long move', async () => {
        let undulation = 30;
        const t = setup({ geoid: async () => undulation });
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });

        undulation = -30;
        await t.moveTo(1, 0);

        expect(t.geoid).toHaveBeenCalledTimes(2);
        expect(t.layers()[0].props.id).toBe('tiles3d-7-1');
        expect(t.translation()[0]).toBeCloseTo(30 * Math.cos(Math.PI / 180));
        expect(t.fetchAccess).toHaveBeenCalledTimes(1);
    });

    it('reloads the tileset when the local up vector turns far enough', async () => {
        const t = setup();
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });

        // Same undulation, but up is now +Z in ECEF
        await t.moveTo(0, 90);

        expect(t.layers()[0].props.id).toBe('tiles3d-7-1');
        expect(t.translation()[2]).toBeCloseTo(-30);
    });

    it('ignores a lookup that finished after a newer one', async () => {
        const pending: Array<(value: number) => void> = [];
        const t = setup({ geoid: () => new Promise<number>((resolve) => pending.push(resolve)) });

        const added = t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });
        pending[0](30);
        await added;

        const first = t.moveTo(10, 0);
        const second = t.moveTo(20, 0);
        pending[2](-20);
        pending[1](-10);
        await Promise.all([first, second]);

        expect(t.translation()[0]).toBeCloseTo(20 * Math.cos(20 * Math.PI / 180));
    });

    it('looks up the undulation again for a tileset added far away after all were removed', async () => {
        let undulation = 30;
        const t = setup({ geoid: async () => undulation });
        await t.manager.add({ id: '7', name: 'osm-buildings', visible: true, opacity: 1 });
        t.manager.remove('7');

        undulation = -30;
        await t.moveTo(0, GEOID_RESAMPLE_M / 111_000 + 1);
        expect(t.geoid).toHaveBeenCalledTimes(1);

        await t.manager.add({ id: '8', name: 'osm-buildings', visible: true, opacity: 1 });

        expect(t.geoid).toHaveBeenCalledTimes(2);
        expect(Math.hypot(...t.translation())).toBeCloseTo(30);
    });
});

describe('exposeCameraTransform', () => {
    it('adds a live transform getter backed by the MapLibre 6 camera', () => {
        const camera = { transform: { height: 720, elevation: 124 } };
        const map: Record<string, unknown> = { _camera: camera };

        exposeCameraTransform(map);
        expect((map.transform as { elevation: number }).elevation).toBe(124);

        // The camera swaps its transform object; the getter must follow it
        camera.transform = { height: 800, elevation: 90 };
        expect((map.transform as { elevation: number }).elevation).toBe(90);
    });

    it('leaves a MapLibre 5 map with its own transform untouched', () => {
        const own = { height: 720, elevation: 5 };
        const map: Record<string, unknown> = { transform: own, _camera: { transform: { height: 1, elevation: 1 } } };

        exposeCameraTransform(map);
        expect(map.transform).toBe(own);
    });

    it('does nothing when the map has no camera', () => {
        const map: Record<string, unknown> = {};

        exposeCameraTransform(map);
        expect('transform' in map).toBe(false);
    });
});

describe('fixGlobalRegions', () => {
    it('replaces globe-wide regions with a sphere and keeps local ones', () => {
        const tileset = {
            root: {
                boundingVolume: { region: [-Math.PI, -1.47, Math.PI, 1.45, -394, 5967] },
                children: [
                    { boundingVolume: { region: [-Math.PI, -1.47, 0, 1.45, -165, 5915] } },
                    { boundingVolume: { region: [0.36, 0.91, 0.37, 0.92, 80, 300] } },
                ],
            },
        };

        fixGlobalRegions(tileset.root);

        expect(tileset.root.boundingVolume).toEqual({ sphere: [0, 0, 0, 6378137 + 5967] });
        expect(tileset.root.children[0].boundingVolume).toEqual({ sphere: [0, 0, 0, 6378137 + 5915] });
        expect(tileset.root.children[1].boundingVolume).toEqual({ region: [0.36, 0.91, 0.37, 0.92, 80, 300] });
    });
});

describe('tilesFetch', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    it('rewrites tileset JSON and keeps the response URL', async () => {
        const body = { root: { boundingVolume: { region: [-Math.PI, -1.4, Math.PI, 1.4, 0, 100] } } };
        const upstream = new Response(JSON.stringify(body), { status: 200 });
        Object.defineProperty(upstream, 'url', { value: 'https://assets/96188/tileset.json?v=1' });
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(upstream);

        const res = await tilesFetch({})('https://assets/96188/tileset.json?v=1');

        expect(res.url).toBe('https://assets/96188/tileset.json?v=1');
        expect((await res.json()).root.boundingVolume).toEqual({ sphere: [0, 0, 0, 6378137 + 100] });
    });

    it('passes binary tiles through untouched', async () => {
        const upstream = new Response('glb-bytes', { status: 200 });
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(upstream);

        const res = await tilesFetch({})('https://assets/96188/1/2/3.b3dm');

        expect(res).toBe(upstream);
    });

    it('passes failed responses through untouched', async () => {
        const upstream = new Response('nope', { status: 404 });
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(upstream);

        const res = await tilesFetch({})('https://assets/96188/tileset.json');

        expect(res).toBe(upstream);
    });
});

describe('formatAttribution', () => {
    it('escapes text', () => {
        expect(formatAttribution({ text: '<script>alert(1)</script> & "x"' }))
            .toBe('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;');
    });

    it('renders an image before the text', () => {
        expect(formatAttribution({ text: 'Cesium ion', image: 'https://assets.ion.cesium.com/ion-credit.png' }))
            .toBe('<img src="https://assets.ion.cesium.com/ion-credit.png" alt="" style="height:1em;vertical-align:middle"> Cesium ion');
    });

    it('escapes quotes in the image URL', () => {
        expect(formatAttribution({ text: '', image: 'https://a.cesium.com/x.png" onerror="alert(1)' }))
            .toBe('<img src="https://a.cesium.com/x.png&quot; onerror=&quot;alert(1)" alt="" style="height:1em;vertical-align:middle">');
    });
});
