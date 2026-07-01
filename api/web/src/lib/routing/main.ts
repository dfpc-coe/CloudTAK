import type { Map as MapLibreMap, IControl, ControlPosition, GeoJSONSource } from 'maplibre-gl';
import type { Feature, LineString, Point, Position, FeatureCollection } from 'geojson';
import { length } from '@turf/length';
import { lineString as turfLineString, point as turfPoint } from '@turf/helpers';
import nearestPointOnLine from '@turf/nearest-point-on-line';

/**
 * Which end of the route is treated as the destination the user is navigating
 * towards. `forward` navigates from the start of the line to its final vertex;
 * `reverse` navigates back towards the first vertex.
 */
export type NavigationDirection = 'forward' | 'reverse';

/**
 * A snapshot of the current navigation solution produced whenever the route or
 * the user's location changes.
 */
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
    /**
     * Invoked whenever the navigation solution is recomputed. Receives `null`
     * when navigation is cleared or a location/route is missing.
     */
    onUpdate?: (state: NavigationState | null) => void;
};

const SOURCE_ROUTE = 'cloudtak-routing-route';
const SOURCE_REMAINING = 'cloudtak-routing-remaining';
const SOURCE_CONNECTOR = 'cloudtak-routing-connector';
const SOURCE_POINTS = 'cloudtak-routing-points';

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

function emptyCollection(): FeatureCollection {
    return { type: 'FeatureCollection', features: [] };
}

/**
 * A MapLibre {@link IControl} that renders live navigation guidance along a TAK
 * Route (a `b-m-r` LineString cursor-on-target feature).
 *
 * The control is renderer-only: it does not own a geolocation watch. The active
 * route is supplied via {@link RoutingControl.setRoute} and the user's position
 * is pushed in via {@link RoutingControl.setLocation}. On each location update
 * the control uses Turf's `nearestPointOnLine` to snap the user to the route,
 * draws a connector from the user to that snapped point, and highlights the
 * remaining segment of the route to the chosen destination. A
 * {@link NavigationState} summary (remaining distance, off-route distance, etc.)
 * is emitted through the `onUpdate` callback so UI such as `Navigating.vue` can
 * render speed / ETA information.
 *
 * @example
 * ```ts
 * const control = new RoutingControl({ onUpdate: (state) => render(state) });
 * map.addControl(control);
 * control.setRoute(routeFeature);
 * control.setLocation({ lng, lat });
 * control.setDirection('reverse');
 * ```
 */
export class RoutingControl implements IControl {
    private readonly options: RoutingControlOptions;

    private map?: MapLibreMap;
    private container?: HTMLElement;

    private route: Feature<LineString> | null = null;
    private location: { lng: number; lat: number } | null = null;
    private direction: NavigationDirection = 'forward';
    private state: NavigationState | null = null;

    constructor(options: RoutingControlOptions = {}) {
        this.options = options;
    }

    onAdd(map: MapLibreMap): HTMLElement {
        this.map = map;

        // Re-attach the navigation layers if the base style is swapped out (e.g.
        // when the user changes basemaps), otherwise the sources are dropped.
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

    /**
     * Whether a route is currently being navigated.
     */
    get active(): boolean {
        return this.route !== null;
    }

    /**
     * Begin navigating the supplied route. Pass `null` to stop navigating and
     * clear all rendered guidance. The feature must be a `LineString` with at
     * least two coordinates.
     */
    setRoute(route: Feature<LineString> | null): void {
        if (!route || route.geometry.type !== 'LineString' || route.geometry.coordinates.length < 2) {
            this.route = null;
            this.state = null;
            this.teardownLayers();
            this.options.onUpdate?.(null);
            return;
        }

        this.route = route;
        this.direction = 'forward';
        this.ensureLayers();
        this.setSourceData(SOURCE_ROUTE, route);
        this.recompute();
    }

    /**
     * Update the user's current position. Pass `null` when location reporting is
     * unavailable so the connector and remaining highlight are cleared.
     */
    setLocation(location: { lng: number; lat: number } | null): void {
        this.location = location;
        this.recompute();
    }

    /**
     * Swap the destination between the start and end of the route.
     */
    setDirection(direction: NavigationDirection): void {
        if (this.direction === direction) return;
        this.direction = direction;
        this.recompute();
    }

    /**
     * Toggle the destination between the start and end of the route.
     */
    reverse(): void {
        this.setDirection(this.direction === 'forward' ? 'reverse' : 'forward');
    }

    /**
     * The current destination end of the route.
     */
    getDirection(): NavigationDirection {
        return this.direction;
    }

    /**
     * The most recently computed navigation solution, or `null`.
     */
    getState(): NavigationState | null {
        return this.state;
    }

    private recompute(): void {
        if (!this.map || !this.route) return;

        if (!this.location) {
            this.setSourceData(SOURCE_REMAINING, emptyCollection());
            this.setSourceData(SOURCE_CONNECTOR, emptyCollection());
            this.setSourceData(SOURCE_POINTS, emptyCollection());
            this.state = null;
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

        // Guarantee a valid two-point line even when the snapped point coincides
        // with the destination vertex.
        if (remainingCoords.length < 2) {
            remainingCoords = [snapCoord, destination];
        }

        const remainingLine = turfLineString(remainingCoords);
        const remaining = length(remainingLine, { units: 'kilometers' });
        const total = length(this.route, { units: 'kilometers' });
        const offRoute = snapped.properties.dist;

        this.setSourceData(SOURCE_REMAINING, remainingLine);
        this.setSourceData(
            SOURCE_CONNECTOR,
            turfLineString([[this.location.lng, this.location.lat], snapCoord])
        );
        this.setSourceData(SOURCE_POINTS, {
            type: 'FeatureCollection',
            features: [
                turfPoint(destination, { role: 'destination' }),
                turfPoint(snapCoord, { role: 'snapped' })
            ]
        });

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

    private ensureLayers(): void {
        const map = this.map;
        if (!map) return;

        // The style may still be loading when the first route is set.
        if (!map.isStyleLoaded()) {
            map.once('idle', () => this.ensureLayers());
            return;
        }

        if (!map.getSource(SOURCE_ROUTE)) {
            map.addSource(SOURCE_ROUTE, { type: 'geojson', data: emptyCollection() });
        }
        if (!map.getSource(SOURCE_REMAINING)) {
            map.addSource(SOURCE_REMAINING, { type: 'geojson', data: emptyCollection() });
        }
        if (!map.getSource(SOURCE_CONNECTOR)) {
            map.addSource(SOURCE_CONNECTOR, { type: 'geojson', data: emptyCollection() });
        }
        if (!map.getSource(SOURCE_POINTS)) {
            map.addSource(SOURCE_POINTS, { type: 'geojson', data: emptyCollection() });
        }

        if (!map.getLayer(LAYER_ROUTE)) {
            map.addLayer({
                id: LAYER_ROUTE,
                type: 'line',
                source: SOURCE_ROUTE,
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: {
                    'line-color': ROUTE_COLOR,
                    'line-width': 6,
                    'line-opacity': 0.5
                }
            });
        }
        if (!map.getLayer(LAYER_ROUTE_ARROWS)) {
            map.addLayer({
                id: LAYER_ROUTE_ARROWS,
                type: 'symbol',
                source: SOURCE_ROUTE,
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
                paint: {
                    'text-color': ROUTE_COLOR,
                    'text-opacity': 0.7,
                }
            });
        }
        if (!map.getLayer(LAYER_REMAINING)) {
            map.addLayer({
                id: LAYER_REMAINING,
                type: 'line',
                source: SOURCE_REMAINING,
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: {
                    'line-color': HIGHLIGHT_COLOR,
                    'line-width': 6,
                    'line-opacity': 0.95
                }
            });
        }
        if (!map.getLayer(LAYER_REMAINING_ARROWS)) {
            map.addLayer({
                id: LAYER_REMAINING_ARROWS,
                type: 'symbol',
                source: SOURCE_REMAINING,
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
                paint: {
                    'text-color': '#ffffff',
                    'text-opacity': 0.9,
                }
            });
        }
        if (!map.getLayer(LAYER_CONNECTOR)) {
            map.addLayer({
                id: LAYER_CONNECTOR,
                type: 'line',
                source: SOURCE_CONNECTOR,
                layout: { 'line-cap': 'round' },
                paint: {
                    'line-color': HIGHLIGHT_COLOR,
                    'line-width': 3,
                    'line-opacity': 0.7,
                    'line-dasharray': [1, 2]
                }
            });
        }
        if (!map.getLayer(LAYER_DESTINATION)) {
            map.addLayer({
                id: LAYER_DESTINATION,
                type: 'circle',
                source: SOURCE_POINTS,
                filter: ['==', ['get', 'role'], 'destination'],
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
                source: SOURCE_POINTS,
                filter: ['==', ['get', 'role'], 'snapped'],
                paint: {
                    'circle-radius': 5,
                    'circle-color': HIGHLIGHT_COLOR,
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 2
                }
            });
        }

        // Repopulate sources that may have been dropped by a style reload.
        if (this.route) this.setSourceData(SOURCE_ROUTE, this.route);
    }

    private teardownLayers(): void {
        const map = this.map;
        if (!map || !map.getStyle()) return;

        for (const layer of [LAYER_SNAPPED, LAYER_DESTINATION, LAYER_CONNECTOR, LAYER_REMAINING_ARROWS, LAYER_REMAINING, LAYER_ROUTE_ARROWS, LAYER_ROUTE]) {
            if (map.getLayer(layer)) map.removeLayer(layer);
        }
        for (const source of [SOURCE_POINTS, SOURCE_CONNECTOR, SOURCE_REMAINING, SOURCE_ROUTE]) {
            if (map.getSource(source)) map.removeSource(source);
        }
    }

    private setSourceData(id: string, data: Feature | FeatureCollection): void {
        const source = this.map?.getSource(id) as GeoJSONSource | undefined;
        if (source) source.setData(data);
    }

    private onStyleData = (): void => {
        // Only rebuild if we are actively navigating and the layers were lost.
        if (this.route && this.map && !this.map.getLayer(LAYER_ROUTE)) {
            this.ensureLayers();
            this.recompute();
        }
    };
}

export default RoutingControl;
