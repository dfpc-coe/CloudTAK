import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TerraDrawExtend, type TerraDrawKeyboardEvent, type TerraDrawMouseEvent } from 'terra-draw';
import type { LineString, Position } from 'geojson';
import { TerraDrawAxisOfAdvanceMode, AXIS_PROPERTIES, AXIS_OF_ADVANCE_MODE } from './terra-draw-axis-of-advance-mode.ts';

// 40 px per degree, so clicks 5 degrees apart are well outside pointerDistance
const PX = 40;

function mockConfig() {
    return {
        mode: AXIS_OF_ADVANCE_MODE,
        store: new TerraDrawExtend.GeoJSONStore(),
        setCursor: vi.fn(),
        onChange: vi.fn(),
        onSelect: vi.fn(),
        onDeselect: vi.fn(),
        project: vi.fn((lng: number, lat: number) => ({ x: lng * PX, y: lat * PX })),
        unproject: vi.fn((x: number, y: number) => ({ lng: x / PX, lat: y / PX })),
        setDoubleClickToZoom: vi.fn(),
        onFinish: vi.fn(),
        coordinatePrecision: 9,
        projection: 'web-mercator' as const,
    };
}

function click(lng: number, lat: number, button: TerraDrawMouseEvent['button'] = 'left'): TerraDrawMouseEvent {
    return { lng, lat, containerX: lng * PX, containerY: lat * PX, button, heldKeys: [], isContextMenu: false };
}

function key(k: string): TerraDrawKeyboardEvent {
    return { key: k, heldKeys: [], preventDefault: () => undefined };
}

function setup() {
    const config = mockConfig();
    const mode = new TerraDrawAxisOfAdvanceMode();
    mode.register(config);
    mode.start();
    return { config, mode, store: config.store };
}

type Store = ReturnType<typeof mockConfig>['store'];

function lines(store: Store) {
    return store.copyAll().filter((f) => f.geometry.type === 'LineString');
}

function polygons(store: Store) {
    return store.copyAll().filter((f) => f.geometry.type === 'Polygon');
}

function points(store: Store) {
    return store.copyAll().filter((f) => f.geometry.type === 'Point');
}

describe('TerraDrawAxisOfAdvanceMode', () => {
    let ctx: ReturnType<typeof setup>;

    beforeEach(() => {
        ctx = setup();
    });

    it('starts with the draw cursor', () => {
        expect(ctx.config.setCursor).toHaveBeenLastCalledWith('crosshair');
        expect(ctx.mode.state).toBe('started');
    });

    it('builds a path from clicks and previews the arrow on move', () => {
        const { mode, store } = ctx;

        mode.onClick(click(0, 0));
        expect(mode.state).toBe('drawing');
        expect(lines(store)).toHaveLength(1);
        expect(points(store)).toHaveLength(1);

        mode.onMouseMove(click(5, 0));
        expect(polygons(store)).toHaveLength(1);

        mode.onClick(click(5, 0));
        mode.onClick(click(10, 0));
        expect(points(store)).toHaveLength(3);

        const line = lines(store)[0];
        expect(line.properties[AXIS_PROPERTIES.committed]).toBe(3);
        expect(line.properties[AXIS_PROPERTIES.step]).toBe('path');
        expect((line.geometry as LineString).coordinates).toHaveLength(4);
    });

    it('ignores right clicks and clicks on top of the last vertex before two points exist', () => {
        const { mode, store } = ctx;

        mode.onClick(click(0, 0, 'right'));
        expect(store.size()).toBe(0);

        mode.onClick(click(0, 0));
        mode.onClick(click(0, 0));
        expect(points(store)).toHaveLength(1);
        expect(lines(store)[0].properties[AXIS_PROPERTIES.step]).toBe('path');
    });

    it('clicking the last vertex again moves to the width step', () => {
        const { mode, store, config } = ctx;

        mode.onClick(click(0, 0));
        mode.onClick(click(10, 0));
        mode.onClick(click(10, 0));

        const line = lines(store)[0];
        expect(line.properties[AXIS_PROPERTIES.step]).toBe('width');
        expect((line.geometry as LineString).coordinates).toEqual([[0, 0], [10, 0]]);
        expect(config.setCursor).toHaveBeenLastCalledWith('ew-resize');
        expect(polygons(store)).toHaveLength(1);
    });

    it('finishes with a head-first centerline, width and control point', () => {
        const { mode, store, config } = ctx;

        mode.onClick(click(0, 0));
        mode.onClick(click(5, 0));
        mode.onClick(click(10, 0));
        mode.onClick(click(10, 0));

        mode.onMouseMove(click(9, 1));
        mode.onClick(click(9, 1));

        expect(config.onFinish).toHaveBeenCalledTimes(1);
        const [id, context] = config.onFinish.mock.calls[0];
        expect(context).toEqual({ mode: AXIS_OF_ADVANCE_MODE, action: 'draw' });

        expect(store.size()).toBe(1);
        const feature = store.copy(id);
        expect((feature.geometry as LineString).coordinates).toEqual([[10, 0], [5, 0], [0, 0]]);
        expect(feature.properties[AXIS_PROPERTIES.width]).toBeGreaterThan(0);
        expect(feature.properties[AXIS_PROPERTIES.controlPoint]).toEqual([9, 1]);
        expect(feature.properties[AXIS_PROPERTIES.step]).toBeUndefined();
        expect(mode.state).toBe('started');
    });

    it('uses the finish key to lock the path and then complete with a default width', () => {
        const { mode, store, config } = ctx;

        mode.onClick(click(0, 0));
        mode.onKeyUp(key('Enter'));
        expect(lines(store)[0].properties[AXIS_PROPERTIES.step]).toBe('path');

        mode.onClick(click(10, 0));
        mode.onKeyUp(key('Enter'));
        expect(lines(store)[0].properties[AXIS_PROPERTIES.step]).toBe('width');

        mode.onKeyUp(key('Enter'));
        expect(config.onFinish).toHaveBeenCalledTimes(1);

        const feature = store.copyAll()[0];
        const width = Number(feature.properties[AXIS_PROPERTIES.width]);
        expect(width).toBeGreaterThan(0);

        const cp = feature.properties[AXIS_PROPERTIES.controlPoint] as Position;
        expect(cp).toHaveLength(2);
    });

    it('cancels and removes every helper feature', () => {
        const { mode, store, config } = ctx;

        mode.onClick(click(0, 0));
        mode.onClick(click(5, 0));
        mode.onMouseMove(click(7, 1));
        expect(store.size()).toBeGreaterThan(1);

        mode.onKeyUp(key('Escape'));
        expect(store.size()).toBe(0);
        expect(config.onFinish).not.toHaveBeenCalled();
        expect(mode.state).toBe('started');
    });

    it('stop cleans up and resets the cursor', () => {
        const { mode, store, config } = ctx;

        mode.onClick(click(0, 0));
        mode.stop();

        expect(store.size()).toBe(0);
        expect(mode.state).toBe('stopped');
        expect(config.setCursor).toHaveBeenLastCalledWith('unset');
    });

    it('drops a finished feature that fails user validation', () => {
        const config = mockConfig();
        const mode = new TerraDrawAxisOfAdvanceMode({
            validation: () => ({ valid: false, reason: 'nope' })
        });
        mode.register(config);
        mode.start();

        mode.onClick(click(0, 0));
        mode.onClick(click(10, 0));
        mode.onKeyUp(key('Enter'));
        mode.onKeyUp(key('Enter'));

        expect(config.onFinish).not.toHaveBeenCalled();
        expect(config.store.size()).toBe(0);
    });

    it('validates only LineStrings with at least two coordinates', () => {
        const { mode } = ctx;

        const base = {
            type: 'Feature',
            id: '0f5e1d2c-3b4a-4c5d-8e6f-7a8b9c0d1e2f',
            properties: { mode: AXIS_OF_ADVANCE_MODE, createdAt: 1, updatedAt: 1 }
        };

        const ok = mode.validateFeature({ ...base, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } });
        expect(ok).toEqual({ valid: true });

        const short = mode.validateFeature({ ...base, geometry: { type: 'LineString', coordinates: [[0, 0]] } });
        expect(short.valid).toBe(false);

        const polygon = mode.validateFeature({ ...base, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } });
        expect(polygon.valid).toBe(false);
    });

    it('styles preview, path and vertices differently', () => {
        const { mode } = ctx;

        const polygon = mode.styleFeature({
            type: 'Feature', id: 'p', properties: { mode: AXIS_OF_ADVANCE_MODE, [AXIS_PROPERTIES.preview]: true },
            geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }
        });
        const line = mode.styleFeature({
            type: 'Feature', id: 'l', properties: { mode: AXIS_OF_ADVANCE_MODE, [AXIS_PROPERTIES.path]: true },
            geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }
        });
        const point = mode.styleFeature({
            type: 'Feature', id: 'v', properties: { mode: AXIS_OF_ADVANCE_MODE, [AXIS_PROPERTIES.point]: true },
            geometry: { type: 'Point', coordinates: [0, 0] }
        });

        expect(polygon.polygonFillOpacity).toBe(0.2);
        expect(line.lineStringOpacity).toBe(0.6);
        expect(point.pointWidth).toBe(5);
        expect(polygon.zIndex).toBeLessThan(line.zIndex);
        expect(line.zIndex).toBeLessThan(point.zIndex);
    });
});
