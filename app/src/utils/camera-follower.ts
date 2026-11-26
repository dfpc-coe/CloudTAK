import type { Map as MapLibreMap } from 'maplibre-gl';

// Time constant of the exponential smoothing, ~95% of a step is covered in 3x this
const SMOOTHING_MS = 120;
const BEARING_EPSILON = 0.05;
const CENTER_EPSILON_PX = 0.5;
// A frame gap longer than this is a resume from a throttled tab rather than an animation frame
const MAX_FRAME_MS = 100;

type Center = { lng: number; lat: number };

/** Signed shortest rotation in degrees (-180, 180] that takes `from` to `to` */
export function shortestRotation(from: number, to: number): number {
    const delta = (((to - from) % 360) + 540) % 360 - 180;
    return delta === -180 ? 180 : delta;
}

/** Fraction of the remaining distance to cover in a frame of `dt` ms */
export function smoothingFactor(dt: number, tau = SMOOTHING_MS): number {
    if (dt <= 0) return 0;
    return 1 - Math.exp(-dt / tau);
}

/**
 * Glides the camera towards a target bearing and centre once per animation
 * frame, so that coarse sensor updates do not step the map.
 */
export class CameraFollower {
    private bearing: number | null = null;
    private center: Center | null = null;
    private frame: number | null = null;
    private last = 0;

    constructor(private readonly map: MapLibreMap) {}

    setBearing(bearing: number | null): void {
        this.bearing = bearing;
        this.schedule();
    }

    setCenter(center: Center | null): void {
        this.center = center ? { lng: center.lng, lat: center.lat } : null;
        this.schedule();
    }

    stop(): void {
        this.bearing = null;
        this.center = null;
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
    }

    private schedule(): void {
        if (this.frame !== null) return;
        if (this.bearing === null && this.center === null) return;

        this.last = 0;
        this.frame = requestAnimationFrame(this.tick);
    }

    private tick = (now: number): void => {
        this.frame = null;

        const dt = this.last ? Math.min(now - this.last, MAX_FRAME_MS) : 1000 / 60;
        this.last = now;

        // A gesture or another camera animation owns the camera
        if (this.map.isMoving()) {
            this.center = null;
            if (this.bearing !== null) this.frame = requestAnimationFrame(this.tick);
            return;
        }

        const k = smoothingFactor(dt);
        const options: { bearing?: number; center?: Center } = {};

        if (this.bearing !== null) {
            const current = this.map.getBearing();
            const delta = shortestRotation(current, this.bearing);

            if (Math.abs(delta) <= BEARING_EPSILON) {
                if (delta !== 0) options.bearing = this.bearing;
                this.bearing = null;
            } else {
                options.bearing = current + delta * k;
            }
        }

        if (this.center !== null) {
            const current = this.map.getCenter();
            const dist = this.map.project(this.center).dist(this.map.project(current));

            if (dist <= CENTER_EPSILON_PX) {
                options.center = this.center;
                this.center = null;
            } else {
                options.center = {
                    lng: current.lng + shortestRotation(current.lng, this.center.lng) * k,
                    lat: current.lat + (this.center.lat - current.lat) * k
                };
            }
        }

        if (options.bearing !== undefined || options.center !== undefined) {
            this.map.jumpTo(options);
        }

        if (this.bearing !== null || this.center !== null) {
            this.frame = requestAnimationFrame(this.tick);
        }
    };
}
