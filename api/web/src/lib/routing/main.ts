import type { Map as MapLibreMap, IControl, ControlPosition, GeoJSONSource } from 'maplibre-gl';
import type { Feature, LineString, Point, Position, FeatureCollection } from 'geojson';
import { length } from '@turf/length';
import { lineString as turfLineString, point as turfPoint } from '@turf/helpers';
import nearestPointOnLine from '@turf/nearest-point-on-line';

export type NavigationDirection = 'forward' | 'reverse';

export interface NavigationState {
    /** Distance remaining along the route to the destination, in kilometers. */
    remaining: number;
    /** Distance from the user to the nearest point on the route, in kilometers. */
    offRoute: number;
    /** Total length of the route, in kilometers. */
    total: number;
    /** The point on the route nearest the user (`[lng, lat]`). */
    snapped: Position;
    /** The destination coordinate the user is navigating towards (`[lng, lat]`). */
    destination: Position;
    /** Which end of the route is the destination. */
    direction: NavigationDirection;
}

export type RoutingControlOptions = {
    onUpdate?: (state: NavigationState | null) => void;
};

const SOURCE = 'cloudtak-routing';

const LAYER_ROUTE = 'cloudtak-routing-route-line';
const LAYER_ROUTE_ARROWS = 'cloudtak-routing-route-arrows';
const LAYER_REMAINING = 'cloudtak-routing-remaining-line';
const LAYER_REMAINING_ARROWS = 'cloudtak-routing-remaining-arrows';
const LAYER_CONNECTOR = 'cloudtak-routing-connector-line';
const LAYER_DESTINATION = 'cloudtak-routing-destination-point';
const LAYER_SNAPPED = 'cloudtak-routing-snapped-point';

const HIGHLIGHT_COLOR = '#1E90FF';
const ROUTE_COLOR = '#8b95a5';
const DESTINATION_COLOR = '#d63939';

export class RoutingControl implements IControl {
    private readonly options: RoutingControlOptions;

    private map?: MapLibreMap;
    private container?: HTMLElement;

    private route: Feature<LineString> | null = null;
    private location: { lng: number; lat: number } | null = null;
    private direction: NavigationDirection = 'forward';
    private state: NavigationState | null = null;

    private remainingLine: Feature<LineString> | null = null;
    private connectorLine: Feature<LineString> | null = null;
    private destinationPoint: Feature<Point> | null = null;
    private snappedPoint: Feature<Point> | null = null;

    constructor(options: RoutingControlOptions = {}) {
        this.options = options;
    }

    onAdd(map: MapLibreMap): HTMLElement {
        this.map = map;
        map.on('styledata', this.onStyleData);

        const container = document.createElement('div');
        container.className = 'maplibregl-ctrl';
        container.style.display = 'none';
        this.container = container;

        return container;
    }

    onRemove(): void {
        if (this.map) {
            this.map.off('styledata', this.onStyleData);
            this.teardownLayers();
        }

        this.container?.remove();
        this.map = undefined;
        this.container = undefined;
    }

    getDefaultPosition(): ControlPosition {
        return 'top-left';
    }

    get active(): boolean {
        return this.route !== null;
    }

    setRoute(route: Feature<LineString> | null): void {
        if (!route || route.geometry.type !== 'LineString' || route.geometry.coordinates.length < 2) {
            this.route = null;
            this.remainingLine = null;
            this.connectorLine = null;
            this.destinationPoint = null;
            this.snappedPoint = null;
            this.state = null;
            this.teardownLayers();
            this.options.onUpdate?.(null);
            return;
        }

        this.route = turfLineString(route.geometry.coordinates, { role: 'route' });
        this.direction = 'forward';
        this.ensureLayers();
        this.recompute();
    }

    setLocation(location: { lng: number; lat: number } | null): void {
        this.location = location;
        this.recompute();
    }

    setDirection(direction: NavigationDirection): void {
        if (this.direction === direction) return;
        this.direction = direction;
        this.recompute();
    }

    reverse(): void {
        this.setDirection(this.direction === 'forward' ? 'reverse' : 'forward');
    }

    getDirection(): NavigationDirection {
        return this.direction;
    }

    getState(): NavigationState | null {
        return this.state;
    }

    private recompute(): void {
        if (!this.map || !this.route) return;

        if (!this.location) {
            this.remainingLine = null;
            this.connectorLine = null;
            this.destinationPoint = null;
            this.snappedPoint = null;
            this.state = null;
            this.updateSource();
            this.options.onUpdate?.(null);
            return;
        }

        const coords = this.route.geometry.coordinates;
        const userPoint = turfPoint([this.location.lng, this.location.lat]);
        const snapped = nearestPointOnLine(this.route, userPoint, { units: 'kilometers' }) as Feature<
            Point,
            { index: number; dist: number; location: number }
        >;

        const index = snapped.properties.index;
        const snapCoord = snapped.geometry.coordinates;

        let remainingCoords: Position[];
        let destination: Position;

        if (this.direction === 'forward') {
            remainingCoords = [snapCoord, ...coords.slice(index + 1)];
            destination = coords[coords.length - 1];
        } else {
            remainingCoords = [snapCoord, ...coords.slice(0, index + 1).reverse()];
            destination = coords[0];
        }

        if (remainingCoords.length < 2) {
            remainingCoords = [snapCoord, destination];
        }

        this.remainingLine = turfLineString(remainingCoords, { role: 'remaining' });
        this.connectorLine = turfLineString(
            [[this.location.lng, this.location.lat], snapCoord],
            { role: 'connector' }
        );
        this.destinationPoint = turfPoint(destination, { role: 'destination' });
        this.snappedPoint = turfPoint(snapCoord, { role: 'snapped' });

        const remaining = length(this.remainingLine, { units: 'kilometers' });
        const total = length(this.route, { units: 'kilometers' });
        const offRoute = snapped.properties.dist;

        this.updateSource();

        this.state = {
            remaining,
            offRoute,
            total,
            snapped: snapCoord,
            destination,
            direction: this.direction
        };

        this.options.onUpdate?.(this.state);
    }

    private buildCollection(): FeatureCollection {
        const features: Feature[] = [];
        if (this.route) features.push(this.route);
        if (this.remainingLine) features.push(this.remainingLine);
        if (this.connectorLine) features.push(this.connectorLine);
        if (this.destinationPoint) features.push(this.destinationPoint);
        if (this.snappedPoint) features.push(this.snappedPoint);
        return { type: 'FeatureCollection', features };
    }

    private updateSource(): void {
        const src = this.map?.getSource(SOURCE) as GeoJSONSource | undefined;
        if (src) src.setData(this.buildCollection());
    }

    private ensureLayers(): void {
        const map = this.map;
        if (!map) return;

        if (!map.isStyleLoaded()) {
            map.once('idle', () => this.ensureLayers());
            return;
        }

        if (!map.getSource(SOURCE)) {
            map.addSource(SOURCE, { type: 'geojson', data: this.buildCollection() });
        }

        if (!map.getLayer(LAYER_ROUTE)) {
            map.addLayer({
                id: LAYER_ROUTE,
                type: 'line',
                source: SOURCE,
                filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'role'], 'route']],
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: { 'line-color': ROUTE_COLOR, 'line-width': 6, 'line-opacity': 0.5 }
            });
        }
        if (!map.getLayer(LAYER_ROUTE_ARROWS)) {
            map.addLayer({
                id: LAYER_ROUTE_ARROWS,
                type: 'symbol',
                source: SOURCE,
                filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'role'], 'route']],
                layout: {
                    'symbol-placement': 'line',
                    'symbol-spacing': 80,
                    'text-field': '▶',
                    'text-size': 12,
                    'text-keep-upright': false,
                    'text-rotation-alignment': 'map',
                    'text-allow-overlap': true,
                    'text-ignore-placement': true,
                },
                paint: { 'text-color': ROUTE_COLOR, 'text-opacity': 0.7 }
            });
        }
        if (!map.getLayer(LAYER_REMAINING)) {
            map.addLayer({
                id: LAYER_REMAINING,
                type: 'line',
                source: SOURCE,
                filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'role'], 'remaining']],
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: { 'line-color': HIGHLIGHT_COLOR, 'line-width': 6, 'line-opacity': 0.95 }
            });
        }
        if (!map.getLayer(LAYER_REMAINING_ARROWS)) {
            map.addLayer({
                id: LAYER_REMAINING_ARROWS,
                type: 'symbol',
                source: SOURCE,
                filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'role'], 'remaining']],
                layout: {
                    'symbol-placement': 'line',
                    'symbol-spacing': 80,
                    'text-field': '▶',
                    'text-size': 12,
                    'text-keep-upright': false,
                    'text-rotation-alignment': 'map',
                    'text-allow-overlap': true,
                    'text-ignore-placement': true,
                },
                paint: { 'text-color': '#ffffff', 'text-opacity': 0.9 }
            });
        }
        if (!map.getLayer(LAYER_CONNECTOR)) {
            map.addLayer({
                id: LAYER_CONNECTOR,
                type: 'line',
                source: SOURCE,
                filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'role'], 'connector']],
                layout: { 'line-cap': 'round' },
                paint: { 'line-color': HIGHLIGHT_COLOR, 'line-width': 3, 'line-opacity': 0.7, 'line-dasharray': [1, 2] }
            });
        }
        if (!map.getLayer(LAYER_DESTINATION)) {
            map.addLayer({
                id: LAYER_DESTINATION,
                type: 'circle',
                source: SOURCE,
                filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'role'], 'destination']],
                paint: {
                    'circle-radius': 8,
                    'circle-color': DESTINATION_COLOR,
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 2
                }
            });
        }
        if (!map.getLayer(LAYER_SNAPPED)) {
            map.addLayer({
                id: LAYER_SNAPPED,
                type: 'circle',
                source: SOURCE,
                filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'role'], 'snapped']],
                paint: {
                    'circle-radius': 5,
                    'circle-color': HIGHLIGHT_COLOR,
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 2
                }
            });
        }

        this.updateSource();
    }

    private teardownLayers(): void {
        const map = this.map;
        if (!map || !map.getStyle()) return;

        for (const layer of [LAYER_SNAPPED, LAYER_DESTINATION, LAYER_CONNECTOR, LAYER_REMAINING_ARROWS, LAYER_REMAINING, LAYER_ROUTE_ARROWS, LAYER_ROUTE]) {
            if (map.getLayer(layer)) map.removeLayer(layer);
        }
        if (map.getSource(SOURCE)) map.removeSource(SOURCE);
    }

    private onStyleData = (): void => {
        if (this.route && this.map && !this.map.getLayer(LAYER_ROUTE)) {
            this.ensureLayers();
            this.recompute();
        }
    };
}

export default RoutingControl;
