import * as mapgl from 'maplibre-gl';
import type { MapLayerMouseEvent, GeoJSONSourceDiff } from 'maplibre-gl';
import type { FeatureCollection, Feature as GeoJSONFeature, Geometry as GeoJSONGeometry, Position } from 'geojson';
import { db, type DBBreadcrumb, type DBFeatureHistory } from '../../database.ts';
import FeatureHistory from '../../base/feature-history.ts';
import COT from '../../base/cot.ts';
import { DrawToolMode } from './draw.ts';
import type { Feature } from '../../types.ts';
import type { useMapStore } from '../map.ts';
import type { HistoryChangeBody } from '../../utils/events.ts';
import router from '../../router.ts';

export const HISTORY_SOURCE = 'cloudtak-history';
export const HISTORY_LINE_LAYER = 'cloudtak-history-line';
export const HISTORY_POINT_LAYER = 'cloudtak-history-point';
export const HISTORY_DEFAULT_COLOR = '#ff0000';
export const HISTORY_POPUP_CLASS = 'cloudtak-history-popup';

const RENDER_DEBOUNCE_MS = 300;
/** A 2px dashed trail and its 5px dots are too small to hit exactly, so a click or hover counts within this many px */
const TRAIL_HIT_PX = 8;
/** A fingertip is far less precise than a mouse - 24px each side is a 48px target */
const TRAIL_HIT_TOUCH_PX = 24;
const STYLE_ID = 'cloudtak-history-style';

/**
 * Returns the popup body for a hovered history point, or nothing to defer
 * to the next renderer / the default body. A string is set as HTML.
 */
export type HistoryPopupRenderer = (row: DBFeatureHistory) => string | HTMLElement | null | undefined;

export type HistoryFeature = GeoJSONFeature<GeoJSONGeometry, Record<string, unknown>> & { id: string };

/** What one UID currently contributes to the source, keyed by feature id */
export type HistoryUidFeatures = Map<string, HistoryFeature>;

export function escapeHtml(input: unknown): string {
    return String(input ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function trailFeatureId(uid: string): string {
    return `${uid}.trail`;
}

/**
 * Points plus one trail line for a single UID, oldest to newest. A trail
 * recorded before history points existed only has legacy coordinates, which
 * are drawn as a line until the UID gains points.
 */
export function historyUidFeatures(uid: string, rows: DBFeatureHistory[], trail?: DBBreadcrumb): HistoryUidFeatures {
    const features: HistoryUidFeatures = new Map();
    const color = (trail && trail.color) || HISTORY_DEFAULT_COLOR;

    const sorted = rows.filter((row) => row.geometry.type === 'Point').sort((a, b) => a.time - b.time);
    const line: Position[] = [];

    for (const row of sorted) {
        if (row.geometry.type !== 'Point') continue;

        const position = row.geometry.coordinates.slice(0, 2);
        line.push(position);

        features.set(row.id, {
            id: row.id,
            type: 'Feature',
            properties: {
                id: row.id,
                uid,
                callsign: row.callsign,
                time: row.time,
                source: row.source,
                color,
            },
            geometry: { type: 'Point', coordinates: position },
        });
    }

    if (line.length >= 2) {
        const id = trailFeatureId(uid);
        features.set(id, {
            id,
            type: 'Feature',
            properties: { id, uid, callsign: sorted[sorted.length - 1].callsign, color, trail: true },
            geometry: { type: 'LineString', coordinates: line },
        });
    } else if (!sorted.length && trail && trail.coordinates && trail.coordinates.length >= 2) {
        const id = trailFeatureId(uid);
        features.set(id, {
            id,
            type: 'Feature',
            properties: { id, uid, callsign: trail.callsign, color, trail: true, legacy: true },
            geometry: { type: 'LineString', coordinates: trail.coordinates },
        });
    }

    return features;
}

/** Every UID's features as one collection - the initial load and the fallback path */
export function historyCollection(rows: DBFeatureHistory[], trails: DBBreadcrumb[]): FeatureCollection<GeoJSONGeometry, Record<string, unknown>> {
    const byUid = new Map<string, DBFeatureHistory[]>();
    for (const row of rows) {
        const list = byUid.get(row.uid);
        if (list) {
            list.push(row);
        } else {
            byUid.set(row.uid, [row]);
        }
    }

    const trailByUid = new Map(trails.map((trail) => [trail.uid, trail]));
    for (const trail of trails) {
        if (!byUid.has(trail.uid)) byUid.set(trail.uid, []);
    }

    const features: HistoryFeature[] = [];
    for (const [uid, list] of byUid) {
        features.push(...historyUidFeatures(uid, list, trailByUid.get(uid)).values());
    }

    return { type: 'FeatureCollection', features };
}

/**
 * The source diff that turns one UID's previous features into its next ones.
 * Points never change once recorded, so they are only added or removed;
 * the trail line is updated in place as it grows.
 */
export function historyDiff(prev: HistoryUidFeatures | undefined, next: HistoryUidFeatures): GeoJSONSourceDiff {
    const diff: GeoJSONSourceDiff = { add: [], remove: [], update: [] };

    if (prev) {
        for (const id of prev.keys()) {
            if (!next.has(id)) diff.remove!.push(id);
        }
    }

    for (const [id, feature] of next) {
        const before = prev ? prev.get(id) : undefined;
        if (!before) {
            diff.add!.push(feature);
        } else if (feature.properties.trail) {
            diff.update!.push({
                id,
                newGeometry: feature.geometry,
                addOrUpdateProperties: Object.entries(feature.properties).map(([key, value]) => ({ key, value })),
            });
        }
    }

    return diff;
}

/** The CoT as it was reported at that point in time, shaped for the feature viewer */
export function historyPointFeature(row: DBFeatureHistory): Feature {
    return {
        id: row.id,
        type: 'Feature',
        path: row.path,
        properties: {
            ...row.properties,
            id: row.id,
            callsign: row.callsign,
            time: new Date(row.time).toISOString(),
        },
        geometry: row.geometry,
    } as Feature;
}

/**
 * @param typeName Human readable CoT type, as the feature views show it;
 *                 falls back to the raw type code until it is resolved
 */
export function defaultPopup(row: DBFeatureHistory, typeName?: string): string {
    const lines = [
        `<div class='cloudtak-history-popup-title'>${escapeHtml(row.callsign)}</div>`,
    ];

    if (row.type) lines.push(`<div class='cloudtak-history-popup-muted'>${escapeHtml(typeName || row.type)}</div>`);

    lines.push(`<div class='cloudtak-history-popup-time'>${escapeHtml(new Date(row.time).toLocaleString())}</div>`);

    const speed = row.properties.speed;
    const course = row.properties.course;
    if (typeof speed === 'number' && Number.isFinite(speed)) {
        lines.push(`<div>Speed: ${escapeHtml(speed.toFixed(1))} m/s</div>`);
    }
    if (typeof course === 'number' && Number.isFinite(course)) {
        lines.push(`<div>Course: ${escapeHtml(Math.round(course))}°</div>`);
    }

    return lines.join('');
}

/**
 * Draws every `feature_history` point and the per-UID trail through them on
 * a dedicated GeoJSON source kept directly beneath the Map Features overlay.
 * The table is read once at startup; afterwards the breadcrumb worker, which
 * owns every write, says which UIDs changed and only those are re-read and
 * diffed into the source. Hovering a point shows who & when; clicking opens
 * the properties the CoT reported at that moment in the feature viewer.
 */
export default class HistoryLayer {
    mapStore: ReturnType<typeof useMapStore>;

    /** Plugin popup renderers, tried in insertion order before the default body */
    renderers: Map<string, HistoryPopupRenderer>;

    private rows: Map<string, DBFeatureHistory>;
    private byUid: Map<string, HistoryUidFeatures>;
    /** Resolved CoT type names, so a hover never waits on the taxonomy lookup */
    private typeNames: Map<string, string>;
    private hovered: string | null;
    private timer: ReturnType<typeof setTimeout> | null;
    private pending: GeoJSONSourceDiff | null;
    /** Changes that arrived while a reload or refresh was still reading */
    private queued: Set<string>;
    private queuedAll: boolean;
    private busy: Promise<void> | null;
    private popup: mapgl.Popup | null;
    private trailCursor: boolean;
    private initialized: boolean;

    constructor(mapStore: ReturnType<typeof useMapStore>) {
        this.mapStore = mapStore;
        this.renderers = new Map();
        this.rows = new Map();
        this.byUid = new Map();
        this.typeNames = new Map();
        this.hovered = null;
        this.timer = null;
        this.pending = null;
        this.queued = new Set();
        this.queuedAll = false;
        this.busy = null;
        this.popup = null;
        this.trailCursor = false;
        this.initialized = false;

        this.onMapClick = this.onMapClick.bind(this);
        this.onTrailMove = this.onTrailMove.bind(this);
        this.onHover = this.onHover.bind(this);
        this.onLeave = this.onLeave.bind(this);
    }

    init(): void {
        if (this.initialized) return;
        const map = this.mapStore.map;

        ensureStyles();

        if (!map.getSource(HISTORY_SOURCE)) {
            map.addSource(HISTORY_SOURCE, {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            });
        }

        if (!map.getLayer(HISTORY_LINE_LAYER)) {
            map.addLayer({
                id: HISTORY_LINE_LAYER,
                type: 'line',
                source: HISTORY_SOURCE,
                filter: ['==', ['geometry-type'], 'LineString'],
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round',
                },
                paint: {
                    'line-color': ['string', ['get', 'color'], HISTORY_DEFAULT_COLOR],
                    'line-width': 2,
                    'line-opacity': 0.9,
                    'line-dasharray': [2, 2],
                },
            });
        }

        if (!map.getLayer(HISTORY_POINT_LAYER)) {
            map.addLayer({
                id: HISTORY_POINT_LAYER,
                type: 'circle',
                source: HISTORY_SOURCE,
                filter: ['==', ['geometry-type'], 'Point'],
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 2.5, 14, 5],
                    'circle-color': ['string', ['get', 'color'], HISTORY_DEFAULT_COLOR],
                    'circle-opacity': 0.9,
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#ffffff',
                },
            });
        }

        map.on('mousemove', HISTORY_POINT_LAYER, this.onHover);
        map.on('mouseleave', HISTORY_POINT_LAYER, this.onLeave);
        // Dots and the trail line are clicked through a tolerance box, which a layer-bound
        // listener cannot do: it only hits the exact pixel, too small a target for a fingertip
        map.on('click', this.onMapClick);
        map.on('mousemove', this.onTrailMove);

        this.initialized = true;
        this.restack();

        this.run(() => this.reload());
    }

    /** The worker reported which trails changed */
    onChange(body: HistoryChangeBody): void {
        if (!this.initialized) return;

        if (body.all) {
            this.queuedAll = true;
        } else {
            for (const uid of body.uids) this.queued.add(uid);
            for (const uid of body.removed) this.queued.add(uid);
        }

        this.run(() => this.drain());
    }

    /** Re-read and redraw the given UIDs - for callers that wrote outside the worker */
    refresh(uids: string[]): void {
        this.onChange({ uids, removed: [] });
    }

    /** Serialize reads so a change that lands mid-read is applied afterwards, not lost */
    private run(task: () => Promise<void>): void {
        if (this.busy) return;

        this.busy = task().catch((err: unknown) => {
            console.error('History layer update failed', err);
        }).finally(() => {
            this.busy = null;
            if (this.initialized && (this.queuedAll || this.queued.size)) this.run(() => this.drain());
        });
    }

    private async drain(): Promise<void> {
        if (this.queuedAll) {
            this.queuedAll = false;
            this.queued.clear();
            await this.reload();
            return;
        }

        const uids = [...this.queued];
        this.queued.clear();

        for (const uid of uids) {
            const [rows, trail] = await Promise.all([
                FeatureHistory.list({ uid }),
                db.breadcrumb.get(`${uid}.track`),
            ]);

            const next = historyUidFeatures(uid, rows, trail);
            const diff = historyDiff(this.byUid.get(uid), next);

            for (const id of this.byUid.get(uid)?.keys() ?? []) {
                if (!next.has(id)) this.rows.delete(id);
            }
            for (const row of rows) this.rows.set(row.id, row);

            if (next.size) {
                this.byUid.set(uid, next);
            } else {
                this.byUid.delete(uid);
            }

            this.schedule(diff);
        }
    }

    /** Read every trail once and replace the source wholesale */
    private async reload(): Promise<void> {
        const [rows, trails] = await Promise.all([
            FeatureHistory.list(),
            db.breadcrumb.toArray(),
        ]);

        if (!this.initialized) return;

        this.rows = new Map(rows.map((row) => [row.id, row]));
        this.byUid = new Map();

        const collection = historyCollection(rows, trails);
        for (const feature of collection.features as HistoryFeature[]) {
            const uid = String(feature.properties.uid);
            let features = this.byUid.get(uid);
            if (!features) {
                features = new Map();
                this.byUid.set(uid, features);
            }
            features.set(feature.id, feature);
        }

        this.cancelPending();

        const source = this.mapStore._map?.getSource(HISTORY_SOURCE) as mapgl.GeoJSONSource | undefined;
        if (source) source.setData(collection);
    }

    /**
     * Keep the history layers directly beneath the Map Features overlay so
     * points never cover live markers but stay above every other overlay
     */
    restack(): void {
        if (!this.initialized) return;
        const map = this.mapStore.map;
        if (!map.getLayer(HISTORY_POINT_LAYER)) return;

        const anchor = map.getLayersOrder().find((id) => id === '-1' || id.startsWith('-1-'));
        if (!anchor) return;

        const order = map.getLayersOrder();
        if (order.indexOf(HISTORY_POINT_LAYER) === order.indexOf(anchor) - 1 && order.indexOf(HISTORY_LINE_LAYER) === order.indexOf(anchor) - 2) return;

        map.moveLayer(HISTORY_LINE_LAYER, anchor);
        map.moveLayer(HISTORY_POINT_LAYER, anchor);
    }

    destroy(): void {
        this.cancelPending();
        this.queued.clear();
        this.queuedAll = false;

        this.onLeave();
        this.popup = null;
        this.trailCursor = false;
        this.rows.clear();
        this.byUid.clear();

        if (!this.initialized) return;
        this.initialized = false;

        const map = this.mapStore._map as mapgl.Map | undefined;
        if (!map) return;

        try {
            map.off('mousemove', HISTORY_POINT_LAYER, this.onHover);
            map.off('mouseleave', HISTORY_POINT_LAYER, this.onLeave);
            map.off('click', this.onMapClick);
            map.off('mousemove', this.onTrailMove);

            if (map.getLayer(HISTORY_POINT_LAYER)) map.removeLayer(HISTORY_POINT_LAYER);
            if (map.getLayer(HISTORY_LINE_LAYER)) map.removeLayer(HISTORY_LINE_LAYER);
            if (map.getSource(HISTORY_SOURCE)) map.removeSource(HISTORY_SOURCE);
        } catch (err) {
            console.error('Failed to remove history layers', err);
        }
    }

    /** Register a popup renderer - the first renderer to return content wins */
    setPopup(key: string, renderer: HistoryPopupRenderer): void {
        this.renderers.set(key, renderer);
    }

    removePopup(key: string): void {
        this.renderers.delete(key);
    }

    /** Open the properties the CoT reported at this point in the feature viewer */
    select(row: DBFeatureHistory): void {
        this.mapStore.viewedFeature = historyPointFeature(row);
        void router.push('/menu/feature');
    }

    /** Fly to the newest history point of a UID */
    async flyTo(uid: string): Promise<boolean> {
        const latest = await FeatureHistory.latest(uid);
        if (!latest || latest.geometry.type !== 'Point') return false;

        this.mapStore.map.flyTo({
            center: latest.geometry.coordinates.slice(0, 2) as [number, number],
            zoom: Math.max(this.mapStore.map.getZoom(), 14),
        });

        return true;
    }

    popupContent(row: DBFeatureHistory): string | HTMLElement {
        for (const renderer of this.renderers.values()) {
            try {
                const content = renderer(row);
                if (content) return content;
            } catch (err) {
                console.error('History popup renderer failed', err);
            }
        }

        return defaultPopup(row, this.typeNames.get(row.type));
    }

    /** Resolve the row's type name once, re-rendering the popup if it is still hovered */
    private resolveTypeName(row: DBFeatureHistory): void {
        if (!row.type || this.typeNames.has(row.type)) return;

        COT.resolveType(row.type).then((resolved) => {
            this.typeNames.set(row.type, resolved.name);

            if (this.hovered === row.id && this.popup && this.popup.isOpen()) {
                this.popup.setHTML(defaultPopup(row, resolved.name));
            }
        }).catch((err) => {
            console.warn('History popup type lookup failed', err);
        });
    }

    /** Merge diffs that arrive within the debounce window into one source update */
    private schedule(diff: GeoJSONSourceDiff): void {
        if (!diff.add?.length && !diff.remove?.length && !diff.update?.length) return;

        if (!this.pending) this.pending = { add: [], remove: [], update: [] };
        this.pending.add!.push(...(diff.add || []));
        this.pending.remove!.push(...(diff.remove || []));
        this.pending.update!.push(...(diff.update || []));

        if (this.timer) return;

        this.timer = setTimeout(() => {
            this.timer = null;
            if (!this.pending || !this.initialized) return;

            const diff = this.pending;
            this.pending = null;

            const source = this.mapStore._map?.getSource(HISTORY_SOURCE) as mapgl.GeoJSONSource | undefined;
            if (!source) return;

            source.updateData(diff).catch((err: unknown) => {
                console.warn('History source diff rejected, reloading', err);
                this.queuedAll = true;
                this.run(() => this.drain());
            });
        }, RENDER_DEBOUNCE_MS);
    }

    private cancelPending(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.pending = null;
    }

    private rowAt(event: MapLayerMouseEvent): DBFeatureHistory | undefined {
        const feat = event.features && event.features[0];
        if (!feat || feat.geometry.type !== 'Point') return;
        return this.rows.get(String(feat.properties.id));
    }

    private onHover(event: MapLayerMouseEvent): void {
        const row = this.rowAt(event);
        if (!row || row.geometry.type !== 'Point') return;

        const map = this.mapStore.map;
        map.getCanvas().style.cursor = 'pointer';

        if (!this.popup) {
            this.popup = new mapgl.Popup({
                closeButton: false,
                closeOnClick: false,
                className: HISTORY_POPUP_CLASS,
                maxWidth: '300px',
            });
        }

        this.hovered = row.id;

        const content = this.popupContent(row);
        if (typeof content === 'string') {
            this.popup.setHTML(content);
        } else {
            this.popup.setDOMContent(content);
        }

        if (content === defaultPopup(row, this.typeNames.get(row.type))) this.resolveTypeName(row);

        this.popup
            .setLngLat(row.geometry.coordinates.slice(0, 2) as [number, number])
            .addTo(map);
    }

    private onLeave(): void {
        this.hovered = null;

        const map = this.mapStore._map as mapgl.Map | undefined;
        if (map) {
            try {
                map.getCanvas().style.cursor = '';
            } catch {
                // The map is being torn down
            }
        }

        if (this.popup) this.popup.remove();
    }

    /** Open the properties the CoT reported at a point of its trail in the feature viewer */
    async open(id: string): Promise<void> {
        const row = this.rows.get(id) ?? await db.feature_history.get(id);
        if (row) this.select(row);
    }

    /**
     * Open the radial menu for a trail - the line or one of its dots (`historyId`).
     * The target is a stand-in feature: RadialMenu and Map.vue only need the UID of the
     * CoT, the dot when there is one, and a key that changes with every click so that
     * clicking another dot of the same trail re-centres the menu.
     */
    private openTrailRadial(uid: string, lngLat: mapgl.LngLat, point: mapgl.Point, historyId?: string): void {
        void this.mapStore.radialClick({
            id: uid,
            type: 'Feature',
            properties: {
                id: uid,
                historyId,
                radialKey: `${historyId ?? 'line'}@${lngLat.lng.toFixed(6)},${lngLat.lat.toFixed(6)}`,
            },
            geometry: { type: 'Point', coordinates: [lngLat.lng, lngLat.lat] },
        } as unknown as Feature, {
            lngLat,
            point,
            mode: 'trail',
        }).catch((err: unknown) => {
            console.error('Failed to open the trail menu', err);
        });
    }

    /** Whether the map can be clicked right now - not mid-draw and not over an open radial */
    private interactive(): boolean {
        return this.mapStore.draw.mode === DrawToolMode.STATIC && !this.mapStore.radial.mode;
    }

    /** How far from a dot or the trail line a click still counts - wider for a finger than a mouse */
    private hitPx(): number {
        const coarse = typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(pointer: coarse)').matches;

        return coarse ? TRAIL_HIT_TOUCH_PX : TRAIL_HIT_PX;
    }

    /** The UID of the trail line within `px` of a screen point, if any */
    private trailAt(point: { x: number; y: number }, px = TRAIL_HIT_PX): string | undefined {
        const map = this.mapStore._map as mapgl.Map | undefined;
        if (!map || !this.byUid.size || !map.getLayer(HISTORY_LINE_LAYER)) return;

        const hits = map.queryRenderedFeatures(
            [[point.x - px, point.y - px], [point.x + px, point.y + px]],
            { layers: [HISTORY_LINE_LAYER] }
        );

        const uid = hits.length ? hits[0].properties.uid : undefined;
        return typeof uid === 'string' ? uid : undefined;
    }

    /** The history dot nearest to a screen point within `px`, if any */
    private dotNear(point: { x: number; y: number }, px: number): DBFeatureHistory | undefined {
        const map = this.mapStore._map as mapgl.Map | undefined;
        if (!map || !map.getLayer(HISTORY_POINT_LAYER)) return;

        const hits = map.queryRenderedFeatures(
            [[point.x - px, point.y - px], [point.x + px, point.y + px]],
            { layers: [HISTORY_POINT_LAYER] }
        );

        let nearest: DBFeatureHistory | undefined;
        let nearestDistance = Infinity;

        for (const hit of hits) {
            const row = this.rows.get(String(hit.properties.id));
            if (!row || row.geometry.type !== 'Point') continue;

            const at = map.project(row.geometry.coordinates.slice(0, 2) as [number, number]);
            const distance = Math.hypot(at.x - point.x, at.y - point.y);

            if (distance < nearestDistance) {
                nearest = row;
                nearestDistance = distance;
            }
        }

        return nearest;
    }

    /** A history point sits exactly under the cursor - it has its own hover & click */
    private pointAt(point: { x: number; y: number }): boolean {
        const map = this.mapStore._map as mapgl.Map | undefined;
        if (!map || !map.getLayer(HISTORY_POINT_LAYER)) return false;
        return map.queryRenderedFeatures([point.x, point.y], { layers: [HISTORY_POINT_LAYER] }).length > 0;
    }

    private onTrailMove(event: mapgl.MapMouseEvent): void {
        const map = this.mapStore._map as mapgl.Map | undefined;
        if (!map) return;

        const over = this.interactive() && this.trailAt(event.point) !== undefined && !this.pointAt(event.point);

        if (over) {
            map.getCanvas().style.cursor = 'pointer';
            this.trailCursor = true;
        } else if (this.trailCursor) {
            // Only undo the cursor this handler set - the points manage their own
            if (!this.hovered) map.getCanvas().style.cursor = '';
            this.trailCursor = false;
        }
    }

    /**
     * A click or tap on a dot or on the trail line. The nearest dot within reach wins, since
     * the dots lie on the line, then the line itself.
     */
    private onMapClick(event: mapgl.MapMouseEvent): void {
        // Mirror the map click handler: never open a point mid-draw or over an open radial
        if (!this.interactive()) return;

        // A live marker under the pointer opens itself
        const covered = this.mapStore.map.queryRenderedFeatures(event.point).some((feat) => {
            return !feat.layer.id.startsWith('cloudtak-history') && feat.properties && feat.properties.id !== undefined;
        });
        if (covered) return;

        const px = this.hitPx();

        const row = this.dotNear(event.point, px);
        if (row && row.geometry.type === 'Point') {
            // Hide the hover popup and open the menu for the trail, centred on the dot
            this.onLeave();
            this.openTrailRadial(
                row.uid,
                new mapgl.LngLat(row.geometry.coordinates[0], row.geometry.coordinates[1]),
                event.point,
                row.id
            );
            return;
        }

        // The same radial menu as a CoT, with the actions that make sense for a trail
        const uid = this.trailAt(event.point, px);
        if (uid !== undefined) this.openTrailRadial(uid, event.lngLat, event.point);
    }
}

function ensureStyles(): void {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
.${HISTORY_POPUP_CLASS} { pointer-events: none; }
.${HISTORY_POPUP_CLASS} .maplibregl-popup-content {
    background: var(--cloudtak-history-popup-bg, rgba(20, 20, 25, 0.96));
    color: var(--cloudtak-history-popup-color, #ffffff);
    padding: 8px 10px;
    border-radius: 4px;
    font-size: 0.8rem;
    line-height: 1.3;
    min-width: 160px;
}
.${HISTORY_POPUP_CLASS} .cloudtak-history-popup-title { font-weight: 600; }

.${HISTORY_POPUP_CLASS} .cloudtak-history-popup-time,
.${HISTORY_POPUP_CLASS} .cloudtak-history-popup-muted { opacity: 0.75; font-size: 0.75rem; }
.${HISTORY_POPUP_CLASS}.maplibregl-popup-anchor-top .maplibregl-popup-tip { border-bottom-color: var(--cloudtak-history-popup-bg, rgba(20, 20, 25, 0.96)); }
.${HISTORY_POPUP_CLASS}.maplibregl-popup-anchor-bottom .maplibregl-popup-tip { border-top-color: var(--cloudtak-history-popup-bg, rgba(20, 20, 25, 0.96)); }
.${HISTORY_POPUP_CLASS}.maplibregl-popup-anchor-left .maplibregl-popup-tip { border-right-color: var(--cloudtak-history-popup-bg, rgba(20, 20, 25, 0.96)); }
.${HISTORY_POPUP_CLASS}.maplibregl-popup-anchor-right .maplibregl-popup-tip { border-left-color: var(--cloudtak-history-popup-bg, rgba(20, 20, 25, 0.96)); }
html[data-bs-theme='light'] .${HISTORY_POPUP_CLASS} {
    --cloudtak-history-popup-bg: rgba(255, 255, 255, 0.98);
    --cloudtak-history-popup-color: #1d273b;
}
`;
    document.head.appendChild(style);
}
