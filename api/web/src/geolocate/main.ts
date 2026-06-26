import { Marker, LngLat, LngLatBounds } from 'maplibre-gl';
import type { Map as MapLibreMap, IControl, ControlPosition, FitBoundsOptions } from 'maplibre-gl';

export type GeolocateControlOptions = {
    /**
     * Camera options used when the map is recentred on the user's location.
     * @defaultValue `{ maxZoom: 16 }`
     */
    fitBoundsOptions?: FitBoundsOptions;
    /**
     * Draw a translucent circle representing the reported GPS accuracy.
     * @defaultValue `true`
     */
    showAccuracyCircle?: boolean;
    /**
     * Draw the user location puck.
     * @defaultValue `true`
     */
    showUserLocation?: boolean;
    /**
     * Draw a heading cone on the puck driven by the device compass.
     * @defaultValue `true`
     */
    showHeading?: boolean;
    /**
     * Invoked when the control button is clicked (after the camera recentres on
     * the current location, if one is known).
     */
    onClick?: () => void;
};

type ResolvedOptions = {
    fitBoundsOptions: FitBoundsOptions;
    showAccuracyCircle: boolean;
    showUserLocation: boolean;
    showHeading: boolean;
    onClick?: () => void;
};

const defaultOptions: ResolvedOptions = {
    fitBoundsOptions: {
        maxZoom: 16
    },
    showAccuracyCircle: true,
    showUserLocation: true,
    showHeading: true
};

const STYLE_ELEMENT_ID = 'cloudtak-geolocate-styles';

/**
 * A MapLibre {@link IControl} that renders a live user-location puck (dot,
 * accuracy circle and compass heading cone).
 *
 * Unlike the stock MapLibre `GeolocateControl`, this control does not own a
 * geolocation watch. Position, accuracy and heading are pushed in via
 * {@link GeolocateControl.setLocation} and {@link GeolocateControl.setHeading}
 * so the existing CloudTAK location pipeline (Capacitor Geolocation in the
 * device store) remains the single source of truth. Clicking the control
 * recentres the camera and invokes the supplied `onClick` handler.
 *
 * @example
 * ```ts
 * import GeolocateControl from './geolocate/main.ts';
 *
 * const control = new GeolocateControl({ onClick: () => openSelfFeature() });
 * map.addControl(control, 'top-right');
 * control.setLocation({ lng, lat }, accuracy);
 * control.setHeading(headingDegrees);
 * ```
 */
export class GeolocateControl implements IControl {
    private readonly options: ResolvedOptions;

    private map?: MapLibreMap;
    private container?: HTMLElement;
    private button?: HTMLButtonElement;

    private puckElement?: HTMLElement;
    private headingElement?: HTMLElement;
    private circleElement?: HTMLElement;

    private dotMarker?: Marker;
    private accuracyMarker?: Marker;

    private lastLngLat: LngLat | null = null;
    private accuracy = 0;
    private heading: number | null = null;

    constructor(options: GeolocateControlOptions = {}) {
        this.options = {
            ...defaultOptions,
            ...options,
            fitBoundsOptions: { ...defaultOptions.fitBoundsOptions, ...options.fitBoundsOptions }
        };
    }

    onAdd(map: MapLibreMap): HTMLElement {
        this.map = map;

        GeolocateControl.injectStyles();

        const container = document.createElement('div');
        container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
        container.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault());

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'maplibregl-ctrl-geolocate';
        button.title = 'Show my location';
        button.setAttribute('aria-label', 'Show my location');

        const icon = document.createElement('span');
        icon.className = 'maplibregl-ctrl-icon';
        icon.setAttribute('aria-hidden', 'true');
        button.appendChild(icon);

        button.addEventListener('click', () => this.onButtonClick());

        container.appendChild(button);

        this.button = button;
        this.container = container;

        this.setupMarkers();

        map.on('zoom', this.onMapUpdate);
        map.on('move', this.onMapUpdate);
        map.on('rotate', this.onMapUpdate);
        map.on('pitch', this.onMapUpdate);

        // Render immediately if a location was supplied before the control was
        // added to the map.
        if (this.lastLngLat) this.render();

        return container;
    }

    onRemove(): void {
        if (this.map) {
            this.map.off('zoom', this.onMapUpdate);
            this.map.off('move', this.onMapUpdate);
            this.map.off('rotate', this.onMapUpdate);
            this.map.off('pitch', this.onMapUpdate);
        }

        this.dotMarker?.remove();
        this.accuracyMarker?.remove();
        this.container?.remove();

        this.map = undefined;
        this.container = undefined;
        this.button = undefined;
    }

    getDefaultPosition(): ControlPosition {
        return 'top-right';
    }

    /**
     * Update the puck position and accuracy. Pass `null` to remove the puck
     * (e.g. when location reporting is disabled).
     */
    setLocation(position: { lng: number; lat: number } | null, accuracy?: number): void {
        if (!position) {
            this.lastLngLat = null;
            this.accuracy = 0;
            this.dotMarker?.remove();
            this.accuracyMarker?.remove();
            this.setButtonActive(false);
            return;
        }

        this.lastLngLat = new LngLat(position.lng, position.lat);
        this.accuracy = typeof accuracy === 'number' && !Number.isNaN(accuracy) ? accuracy : 0;
        this.setButtonActive(true);
        this.render();
    }

    /**
     * Update the compass heading (degrees clockwise from true north) used to
     * orient the puck's heading cone. Pass `null` to hide the cone.
     */
    setHeading(heading: number | null): void {
        this.heading = heading;
        this.updateHeadingRotation();
    }

    private onButtonClick(): void {
        if (this.lastLngLat) this.flyToLocation();
        this.options.onClick?.();
    }

    private setupMarkers(): void {
        if (this.options.showAccuracyCircle) {
            const circle = document.createElement('div');
            circle.className = 'cloudtak-geolocate-accuracy-circle';
            this.circleElement = circle;
            this.accuracyMarker = new Marker({ element: circle, pitchAlignment: 'map' });
        }

        if (this.options.showUserLocation) {
            const puck = document.createElement('div');
            puck.className = 'cloudtak-geolocate-puck';

            if (this.options.showHeading) {
                const heading = document.createElement('div');
                heading.className = 'cloudtak-geolocate-heading';
                heading.style.display = 'none';
                puck.appendChild(heading);
                this.headingElement = heading;
            }

            const dot = document.createElement('div');
            dot.className = 'cloudtak-geolocate-dot';
            puck.appendChild(dot);

            this.puckElement = puck;
            this.dotMarker = new Marker({ element: puck });
        }
    }

    private render(): void {
        if (!this.map || !this.lastLngLat) return;

        if (this.dotMarker) this.dotMarker.setLngLat(this.lastLngLat).addTo(this.map);
        if (this.accuracyMarker) this.accuracyMarker.setLngLat(this.lastLngLat).addTo(this.map);

        this.updateCircleRadius();
        this.updateHeadingRotation();
    }

    private flyToLocation(): void {
        if (!this.map || !this.lastLngLat) return;

        if (this.accuracy > 0) {
            const bounds = LngLatBounds.fromLngLat(this.lastLngLat, this.accuracy);
            this.map.fitBounds(bounds, {
                bearing: this.map.getBearing(),
                ...this.options.fitBoundsOptions
            });
        } else {
            this.map.flyTo({ center: this.lastLngLat });
        }
    }

    private updateCircleRadius(): void {
        if (!this.map || !this.circleElement || !this.lastLngLat || !this.accuracy) return;

        const screen = this.map.project(this.lastLngLat);
        const offset = this.map.unproject([screen.x + 100, screen.y]);
        const metersPerPixel = this.lastLngLat.distanceTo(offset) / 100;
        const diameter = (2 * this.accuracy) / metersPerPixel;

        this.circleElement.style.width = `${diameter.toFixed(2)}px`;
        this.circleElement.style.height = `${diameter.toFixed(2)}px`;
    }

    private updateHeadingRotation(): void {
        if (!this.map || !this.headingElement) return;

        if (this.heading === null) {
            this.headingElement.style.display = 'none';
            return;
        }

        // Compensate for the current map rotation so the cone points at the
        // true compass heading rather than a screen-fixed direction. The
        // translate keeps the cone's base anchored to the puck centre while it
        // rotates about that point (see `transform-origin` in the CSS).
        const rotation = this.heading - this.map.getBearing();
        this.headingElement.style.display = '';
        this.headingElement.style.transform = `translate(-50%, -100%) rotate(${rotation}deg)`;
    }

    private onMapUpdate = (): void => {
        this.updateCircleRadius();
        this.updateHeadingRotation();
    };

    private setButtonActive(active: boolean): void {
        if (!this.button) return;
        this.button.classList.toggle('maplibregl-ctrl-geolocate-active', active);
    }

    private static injectStyles(): void {
        if (typeof document === 'undefined' || document.getElementById(STYLE_ELEMENT_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ELEMENT_ID;
        style.textContent = `
.cloudtak-geolocate-puck {
    position: relative;
    width: 18px;
    height: 18px;
}
.cloudtak-geolocate-dot {
    position: absolute;
    top: 0;
    left: 0;
    width: 18px;
    height: 18px;
    background-color: #1da1f2;
    border: 2px solid #fff;
    border-radius: 50%;
    box-sizing: border-box;
    box-shadow: 0 0 3px rgb(0 0 0 / 0.35);
}
.cloudtak-geolocate-heading {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    border-left: 14px solid transparent;
    border-right: 14px solid transparent;
    border-bottom: 28px solid rgb(29 161 242 / 0.45);
    transform-origin: 50% 100%;
    transform: translate(-50%, -100%) rotate(0deg);
    pointer-events: none;
}
.cloudtak-geolocate-accuracy-circle {
    width: 1px;
    height: 1px;
    background-color: rgb(29 161 242 / 0.2);
    border-radius: 50%;
}`;

        document.head.appendChild(style);
    }
}

export default GeolocateControl;
