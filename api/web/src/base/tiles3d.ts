/**
 * Cesium ion 3D Tiles overlays rendered by deck.gl inside MapLibre.
 *
 * deck.gl and loaders.gl are loaded only by getTiles3D(), so users without
 * a 3D overlay never download them.
 * Everything above getTiles3D() takes its dependencies as arguments to stay
 * testable without WebGL.
 */

import type { IonAccess } from '../types.ts';
import { useMapStore } from '../stores/map.ts';
import { server } from '../std.ts';
import OverlayManager from './overlay.ts';

export type { IonAccess };
export type IonAttribution = IonAccess['attributions'][number];

export interface Tiles3DEntry {
    id: string;
    name: string;
    visible: boolean;
    opacity: number;
}

interface MapLike {
    addControl(control: unknown): unknown;
    removeControl(control: unknown): unknown;
    getLayer(id: string): unknown;
    on(type: 'moveend', listener: () => void): unknown;
    off(type: 'moveend', listener: () => void): unknown;
}

interface DeckOverlayLike {
    setProps(props: Record<string, unknown>): void;
    finalize(): void;
}

export interface DeckModules {
    MapboxOverlay: new (props: Record<string, unknown>) => DeckOverlayLike;
    Tile3DLayer: new (props: Record<string, unknown>) => unknown;
    Tiles3DLoader: unknown;
    Matrix4: new () => { translate(v: number[]): unknown };
}

export interface TilesetNode {
    boundingVolume?: { region?: number[]; sphere?: number[]; box?: number[] };
    children?: TilesetNode[];
}

interface State {
    entry: Tiles3DEntry;
    access: IonAccess;
    generation: number;
    timer: ReturnType<typeof setTimeout>;
    lastAuthRefresh: number | null;
}

export const REFRESH_MS = 50 * 60 * 1000;
export const AUTH_RETRY_GUARD_MS = 60 * 1000;
// A failed scheduled refresh must not end the refresh cycle, so retry sooner
export const SCHEDULE_RETRY_MS = 60 * 1000;
// Tilesets are reloaded to apply a new vertical shift, so ignore small changes
export const SHIFT_TOLERANCE_M = 1;
// The geoid varies slowly, so only look it up again after a long move
export const GEOID_RESAMPLE_M = 50 * 1000;

const EARTH_RADIUS_M = 6378137;

function distance(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * loaders.gl turns a globe-wide `region` into a degenerate oriented box, so
 * tilesets such as Cesium OSM Buildings never select a tile. Swap those
 * volumes for a sphere around the Earth.
 */
export function fixGlobalRegions(node: TilesetNode): void {
    const region = node.boundingVolume?.region;
    if (region && (region[2] - region[0] > Math.PI / 2 || region[3] - region[1] > Math.PI / 2)) {
        node.boundingVolume = { sphere: [0, 0, 0, EARTH_RADIUS_M + Math.max(0, region[5])] };
    }

    for (const child of node.children ?? []) fixGlobalRegions(child);
}

/**
 * Fetch used by loaders.gl for every tileset request: adds ion auth headers
 * and repairs globe-wide bounding volumes in tileset JSON.
 */
export function tilesFetch(headers: Record<string, string>): (url: string, init?: RequestInit) => Promise<Response> {
    return async (url, init = {}) => {
        const merged = new Headers(init.headers);
        for (const [k, v] of Object.entries(headers)) merged.set(k, v);

        const res = await fetch(url, { ...init, headers: merged });
        if (!res.ok || !/\.json(\?|$)/.test(url)) return res;

        const json = await res.json() as { root?: TilesetNode };
        if (json.root) fixGlobalRegions(json.root);

        const fixed = new Response(JSON.stringify(json), { status: res.status, headers: { 'Content-Type': 'application/json' } });
        // loaders.gl resolves relative child URIs against response.url
        Object.defineProperty(fixed, 'url', { value: res.url || url });
        return fixed;
    };
}

/**
 * MapLibre 6 moved the camera out of Map: `map.transform` is gone and lives on
 * `map._camera.transform`. @deck.gl/mapbox 9.4 still reads `map.transform`
 * (height, elevation) on every interleaved draw and throws without it, so no
 * tile is ever drawn. Restore the MapLibre 5 accessor as a live getter.
 */
export function exposeCameraTransform(map: object): void {
    if ('transform' in map) return;

    const camera = (map as { _camera?: { transform?: unknown } })._camera;
    if (!camera || !camera.transform) return;

    Object.defineProperty(map, 'transform', {
        configurable: true,
        get: () => camera.transform,
    });
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function formatAttribution(a: IonAttribution): string {
    const img = a.image
        ? `<img src="${escapeHtml(a.image)}" alt="" style="height:1em;vertical-align:middle">`
        : '';
    return [img, escapeHtml(a.text)].filter(Boolean).join(' ');
}

export class Tiles3DManager {
    readonly map: MapLike;
    private deck: DeckModules;
    private fetchAccess: (name: string) => Promise<IonAccess>;
    private beforeId: () => string | undefined;
    private center: () => { lng: number; lat: number };
    private geoid: (lat: number, lng: number) => Promise<number>;
    private undulation: { lng: number; lat: number; value: number } | null = null;
    private undulationRequest = 0;
    private shift: number[] | null = null;
    private now: () => number;
    private onChange: () => void;
    private overlay: DeckOverlayLike | null = null;
    private states = new Map<string, State>();
    private pendingAdds = new Map<string, symbol>();
    private destroyed = false;

    constructor(deps: {
        map: MapLike;
        deck: DeckModules;
        fetchAccess: (name: string) => Promise<IonAccess>;
        beforeId: () => string | undefined;
        center: () => { lng: number; lat: number };
        geoid: (lat: number, lng: number) => Promise<number>;
        now?: () => number;
        onChange?: () => void;
    }) {
        this.map = deps.map;
        this.deck = deps.deck;
        this.fetchAccess = deps.fetchAccess;
        this.beforeId = deps.beforeId;
        this.center = deps.center;
        this.geoid = deps.geoid;
        this.now = deps.now ?? Date.now;
        this.onChange = deps.onChange ?? (() => {});
    }

    async add(entry: Tiles3DEntry): Promise<void> {
        // Only the most recently started add() for this id may commit: an older
        // in-flight call must not resurrect a removed layer or clobber a newer one.
        const token = Symbol();
        this.pendingAdds.set(entry.id, token);

        const [access] = await Promise.all([
            this.fetchAccess(entry.name),
            this.sampleUndulation(),
        ]);

        if (this.destroyed || this.pendingAdds.get(entry.id) !== token) return;
        this.pendingAdds.delete(entry.id);

        this.remove(entry.id);
        this.states.set(entry.id, {
            entry: { ...entry },
            access,
            generation: 0,
            timer: this.schedule(entry.id),
            lastAuthRefresh: null,
        });

        this.render();
    }

    remove(id: string): void {
        // Cancel any in-flight add() for this id so its late continuation cannot commit
        this.pendingAdds.delete(id);

        const state = this.states.get(id);
        if (!state) return;

        clearTimeout(state.timer);
        this.states.delete(id);
        this.render();
    }

    setVisible(id: string, visible: boolean): void {
        const state = this.states.get(id);
        if (!state) return;
        state.entry.visible = visible;
        this.render();
    }

    setOpacity(id: string, opacity: number): void {
        const state = this.states.get(id);
        if (!state) return;
        state.entry.opacity = opacity;
        this.render();
    }

    async refresh(id: string): Promise<void> {
        const before = this.states.get(id);
        if (!before) return;

        const access = await this.fetchAccess(before.entry.name);

        // The manager may have been destroyed, or the overlay removed or re-added, while we waited
        if (this.destroyed) return;
        const state = this.states.get(id);
        if (state !== before) return;

        clearTimeout(state.timer);
        state.access = access;
        state.generation++;
        state.timer = this.schedule(id);
        this.render();
    }

    hasVisible(): boolean {
        for (const state of this.states.values()) {
            if (state.entry.visible) return true;
        }
        return false;
    }

    attributions(): IonAttribution[] {
        const seen = new Set<string>();
        const out: IonAttribution[] = [];

        for (const state of this.states.values()) {
            if (!state.entry.visible) continue;
            for (const a of state.access.attributions) {
                const key = `${a.text}\u0000${a.image ?? ''}`;
                if (seen.has(key)) continue;
                seen.add(key);
                out.push(a);
            }
        }

        return out;
    }

    render(): void {
        if (this.destroyed) return;

        if (!this.overlay) {
            if (!this.states.size) return;
            exposeCameraTransform(this.map);
            this.overlay = new this.deck.MapboxOverlay({ interleaved: true, layers: [] });
            this.map.addControl(this.overlay);
            this.map.on('moveend', this.onMoveEnd);
        }

        // Measured at the map center when the first tileset is drawn
        if (!this.states.size) this.shift = null;
        else if (!this.shift) this.shift = this.verticalShift();

        const candidate = this.beforeId();
        const beforeId = candidate && this.map.getLayer(candidate) ? candidate : undefined;

        this.overlay.setProps({
            layers: Array.from(this.states.values()).map((state) => this.layer(state, beforeId)),
        });

        this.onChange();
    }

    get isDestroyed(): boolean {
        return this.destroyed;
    }

    destroy(): void {
        this.destroyed = true;
        this.pendingAdds.clear();

        for (const state of this.states.values()) clearTimeout(state.timer);
        this.states.clear();

        if (this.overlay) {
            this.map.off('moveend', this.onMoveEnd);
            this.map.removeControl(this.overlay);
            this.overlay.finalize();
            this.overlay = null;
        }
    }

    private layer(state: State, beforeId: string | undefined): unknown {
        const id = state.entry.id;

        return new this.deck.Tile3DLayer({
            id: `tiles3d-${id}-${state.generation}`,
            data: state.access.url,
            loader: this.deck.Tiles3DLoader,
            visible: state.entry.visible,
            opacity: state.entry.opacity,
            beforeId,
            loadOptions: {
                // Top-level loadOptions.fetch is deprecated by loaders.gl
                core: {
                    fetch: tilesFetch(state.access.accessToken ? { Authorization: `Bearer ${state.access.accessToken}` } : {}),
                },
                tileset: { modelMatrix: new this.deck.Matrix4().translate(this.shift ?? [0, 0, 0]) },
            },
            onTileError: (...args: unknown[]) => this.onTileError(id, args),
        });
    }

    /**
     * ion tiles use ellipsoidal heights while MapLibre terrain is relative to
     * mean sea level, so lower the tilesets by the EGM96 geoid undulation
     * along the local up vector at the map center
     */
    private verticalShift(): number[] {
        const { lng, lat } = this.center();
        const undulation = this.undulation ? this.undulation.value : 0;
        const lon = lng * Math.PI / 180;
        const phi = lat * Math.PI / 180;
        const up = [Math.cos(phi) * Math.cos(lon), Math.cos(phi) * Math.sin(lon), Math.sin(phi)];
        return up.map((u) => -u * undulation);
    }

    /**
     * Look up the geoid undulation at the map center unless the last lookup
     * was close by. A failed lookup leaves the tilesets unshifted.
     */
    private async sampleUndulation(): Promise<void> {
        const center = this.center();
        if (this.undulation && distance(this.undulation, center) <= GEOID_RESAMPLE_M) return;

        const request = ++this.undulationRequest;

        let value = 0;
        try {
            value = await this.geoid(center.lat, center.lng);
        } catch (err) {
            console.warn('Failed to get the geoid undulation, 3D Tiles are drawn without a vertical shift', err);
        }

        // Only the most recent lookup may win when the map moves again meanwhile
        if (request !== this.undulationRequest) return;
        this.undulation = { lng: center.lng, lat: center.lat, value };
    }

    private onMoveEnd = async (): Promise<void> => {
        if (this.destroyed || !this.shift || !this.states.size) return;

        await this.sampleUndulation();

        const current = this.shift;
        if (this.destroyed || !current || !this.states.size) return;

        const next = this.verticalShift();
        if (Math.hypot(...next.map((v, i) => v - current[i])) <= SHIFT_TOLERANCE_M) return;

        this.shift = next;
        for (const state of this.states.values()) state.generation++;
        this.render();
    };

    private schedule(id: string): ReturnType<typeof setTimeout> {
        return setTimeout(() => {
            this.refresh(id).catch((err) => {
                console.error(`Failed to refresh 3D Tiles access for overlay ${id}`, err);
                this.rearmAfterFailedRefresh(id);
            });
        }, REFRESH_MS);
    }

    // refresh() only re-arms the timer on success, so a failure re-arms it here
    private rearmAfterFailedRefresh(id: string): void {
        if (this.destroyed) return;
        const state = this.states.get(id);
        if (!state) return;

        // A re-added entry already has its own timer, which must not leak
        clearTimeout(state.timer);

        state.timer = setTimeout(() => {
            this.refresh(id).catch((err) => {
                console.error(`Failed to refresh 3D Tiles access for overlay ${id}`, err);
                this.rearmAfterFailedRefresh(id);
            });
        }, SCHEDULE_RETRY_MS);
    }

    private onTileError(id: string, args: unknown[]): void {
        const message = args.map((a) => a instanceof Error ? a.message : String(a)).join(' ');
        if (!/\b401\b/.test(message)) return;

        const state = this.states.get(id);
        if (!state) return;

        const now = this.now();
        if (state.lastAuthRefresh !== null && now - state.lastAuthRefresh < AUTH_RETRY_GUARD_MS) return;
        state.lastAuthRefresh = now;

        setTimeout(() => {
            this.refresh(id).catch((err) => console.error(`Failed to refresh 3D Tiles access for overlay ${id}`, err));
        }, 0);
    }
}

let manager: Tiles3DManager | null = null;
let pending: Promise<Tiles3DManager> | null = null;

export function peekTiles3D(): Tiles3DManager | null {
    return manager;
}

export async function getTiles3D(): Promise<Tiles3DManager> {
    if (pending) return await pending;

    pending = (async () => {
        const [{ MapboxOverlay }, { Tile3DLayer }, { Tiles3DLoader }, { Matrix4 }] = await Promise.all([
            import('@deck.gl/mapbox'),
            import('@deck.gl/geo-layers'),
            import('@loaders.gl/3d-tiles'),
            import('@math.gl/core'),
        ]);

        const mapStore = useMapStore();

        // The map store can replace its MapLibre instance or destroy the manager
        // on logout, so never hand back a manager bound to a stale map
        if (manager && manager.map === (mapStore.map as unknown) && !manager.isDestroyed) return manager;
        if (manager && !manager.isDestroyed) manager.destroy();

        manager = new Tiles3DManager({
            map: mapStore.map as unknown as MapLike,
            deck: {
                MapboxOverlay: MapboxOverlay as unknown as DeckModules['MapboxOverlay'],
                Tile3DLayer: Tile3DLayer as unknown as DeckModules['Tile3DLayer'],
                Tiles3DLoader,
                Matrix4,
            },
            fetchAccess: async (name) => {
                const { data, error } = await server.GET('/api/ion/{:name}/endpoint', {
                    params: { path: { ':name': name } }
                });

                if (error) throw new Error(error.message);
                if (!data) throw new Error('No data returned');

                return data;
            },
            beforeId: () => {
                const cot = OverlayManager.loadedFrom(-1);
                return cot && cot.styles.length ? String(cot.styles[0].id) : undefined;
            },
            center: () => mapStore.map.getCenter(),
            geoid: async (lat, lon) => {
                const { data, error } = await server.GET('/api/ion/geoid', {
                    params: { query: { lat, lon } }
                });

                if (error) throw new Error(error.message);
                if (!data) throw new Error('No data returned');

                return data.undulation;
            },
            onChange: () => {
                mapStore.updateAttribution().catch((err: unknown) => console.error('Failed to update attribution', err));
            },
        });

        return manager;
    })();

    try {
        return await pending;
    } finally {
        // A failed chunk load must not block later attempts
        pending = null;
    }
}
