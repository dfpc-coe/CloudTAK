import * as mapgl from 'maplibre-gl';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import type { Subscription } from 'dexie';
import type { FeatureCollection, Feature as GeoJSONFeature, Geometry as GeoJSONGeometry, Position } from 'geojson';
import { db, liveQuery, type DBBreadcrumb, type DBFeatureHistory } from '../../database.ts';
import FeatureHistory from '../../base/feature-history.ts';
import COT from '../../base/cot.ts';
import { DrawToolMode } from './draw.ts';
import type { Feature } from '../../types.ts';
import type { useMapStore } from '../map.ts';
import router from '../../router.ts';

export const HISTORY_SOURCE = 'cloudtak-history';
export const HISTORY_LINE_LAYER = 'cloudtak-history-line';
export const HISTORY_POINT_LAYER = 'cloudtak-history-point';
export const HISTORY_DEFAULT_COLOR = '#ff0000';
export const HISTORY_POPUP_CLASS = 'cloudtak-history-popup';

const RENDER_DEBOUNCE_MS = 300;
const STYLE_ID = 'cloudtak-history-style';

/**
 * Returns the popup body for a hovered history point, or nothing to defer
 * to the next renderer / the default body. A string is set as HTML.
 */
export type HistoryPopupRenderer = (row: DBFeatureHistory) => string | HTMLElement | null | undefined;

type HistoryFeature = GeoJSONFeature<GeoJSONGeometry, Record<string, unknown>>;

export function escapeHtml(input: unknown): string {
    return String(input ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Points plus one trail line per UID, oldest to newest. Trails recorded
 * before history points existed only have legacy coordinates, which are
 * drawn as a line until the UID gains points.
 */
export function historyCollection(rows: DBFeatureHistory[], trails: DBBreadcrumb[]): FeatureCollection<GeoJSONGeometry, Record<string, unknown>> {
    const colors = new Map<string, string>();
    for (const trail of trails) {
        if (trail.color) colors.set(trail.uid, trail.color);
    }

    const byUid = new Map<string, DBFeatureHistory[]>();
    for (const row of rows) {
        const list = byUid.get(row.uid);
        if (list) {
            list.push(row);
        } else {
            byUid.set(row.uid, [row]);
        }
    }

    const features: HistoryFeature[] = [];

    for (const [uid, list] of byUid) {
        list.sort((a, b) => a.time - b.time);

        const color = colors.get(uid) || HISTORY_DEFAULT_COLOR;
        const line: Position[] = [];

        for (const row of list) {
            if (row.geometry.type !== 'Point') continue;

            const position = row.geometry.coordinates.slice(0, 2);
            line.push(position);

            features.push({
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
            features.push({
                type: 'Feature',
                properties: { uid, callsign: list[list.length - 1].callsign, color, trail: true },
                geometry: { type: 'LineString', coordinates: line },
            });
        }
    }

    for (const trail of trails) {
        if (byUid.has(trail.uid)) continue;
        if (!trail.coordinates || trail.coordinates.length < 2) continue;

        features.push({
            type: 'Feature',
            properties: { uid: trail.uid, callsign: trail.callsign, color: trail.color || HISTORY_DEFAULT_COLOR, trail: true, legacy: true },
            geometry: { type: 'LineString', coordinates: trail.coordinates },
        });
    }

    return { type: 'FeatureCollection', features };
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
 * Hovering a point shows who & when; clicking opens the properties the CoT
 * reported at that moment in the feature viewer.
 */
export default class HistoryLayer {
    mapStore: ReturnType<typeof useMapStore>;

    /** Plugin popup renderers, tried in insertion order before the default body */
    renderers: Map<string, HistoryPopupRenderer>;

    private rows: Map<string, DBFeatureHistory>;
    /** Resolved CoT type names, so a hover never waits on the taxonomy lookup */
    private typeNames: Map<string, string>;
    private hovered: string | null;
    private subscription: Subscription | null;
    private timer: ReturnType<typeof setTimeout> | null;
    private pending: FeatureCollection<GeoJSONGeometry, Record<string, unknown>> | null;
    private popup: mapgl.Popup | null;
    private initialized: boolean;

    constructor(mapStore: ReturnType<typeof useMapStore>) {
        this.mapStore = mapStore;
        this.renderers = new Map();
        this.rows = new Map();
        this.typeNames = new Map();
        this.hovered = null;
        this.subscription = null;
        this.timer = null;
        this.pending = null;
        this.popup = null;
        this.initialized = false;

        this.onHover = this.onHover.bind(this);
        this.onLeave = this.onLeave.bind(this);
        this.onClick = this.onClick.bind(this);
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
        map.on('click', HISTORY_POINT_LAYER, this.onClick);

        this.subscription = liveQuery(async () => {
            const [rows, trails] = await Promise.all([
                db.feature_history.toArray(),
                db.breadcrumb.toArray(),
            ]);
            return { rows, trails };
        }).subscribe({
            next: ({ rows, trails }) => {
                this.rows = new Map(rows.map((row) => [row.id, row]));
                this.schedule(historyCollection(rows, trails));
            },
            error: (err: unknown) => {
                console.error('History layer subscription failed', err);
            },
        });

        this.initialized = true;
        this.restack();
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
        if (this.subscription) {
            this.subscription.unsubscribe();
            this.subscription = null;
        }

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.pending = null;

        this.onLeave();
        this.popup = null;
        this.rows.clear();

        if (!this.initialized) return;
        this.initialized = false;

        const map = this.mapStore._map as mapgl.Map | undefined;
        if (!map) return;

        try {
            map.off('mousemove', HISTORY_POINT_LAYER, this.onHover);
            map.off('mouseleave', HISTORY_POINT_LAYER, this.onLeave);
            map.off('click', HISTORY_POINT_LAYER, this.onClick);

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

    private schedule(collection: FeatureCollection<GeoJSONGeometry, Record<string, unknown>>): void {
        this.pending = collection;
        if (this.timer) return;

        this.timer = setTimeout(() => {
            this.timer = null;
            if (!this.pending || !this.initialized) return;

            const source = this.mapStore._map?.getSource(HISTORY_SOURCE) as mapgl.GeoJSONSource | undefined;
            if (source) source.setData(this.pending);
            this.pending = null;
        }, RENDER_DEBOUNCE_MS);
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

    private onClick(event: MapLayerMouseEvent): void {
        // Mirror the map click handler: never open a point mid-draw or over an open radial
        if (this.mapStore.draw.mode !== DrawToolMode.STATIC) return;
        if (this.mapStore.radial.mode) return;

        const row = this.rowAt(event);
        if (!row) return;

        // A live marker under the cursor takes precedence - the map click handler opens it
        const covered = this.mapStore.map.queryRenderedFeatures(event.point).some((feat) => {
            return !feat.layer.id.startsWith('cloudtak-history') && feat.properties && feat.properties.id !== undefined;
        });
        if (covered) return;

        this.select(row);
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
