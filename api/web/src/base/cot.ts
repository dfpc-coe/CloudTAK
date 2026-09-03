import { v4 as randomUUID } from 'uuid';
import Type2525 from '@tak-ps/node-cot/2525';
import { std } from '../std.ts';
import { db, withDbRetry } from '../database.ts';
import { liveQuery } from 'dexie';
import { bbox } from '@turf/bbox'
import { length } from '@turf/length'
import { isEqual } from '@ver0/deep-equal';
import { WorkerMessageType } from '../utils/events.ts'
import { TEAM_COLORS, strokeColorFor } from '../utils/team-colors.ts';
import pointOnFeature from '@turf/point-on-feature';
import { applyEllipseMutation } from './cot/ellipse.ts';
import type { COTMutation, COTUpdate } from './cot/types.ts';
import type { Feature, Subscription } from '../types.ts'
import type {
    BBox as GeoJSONBBox,
    Feature as GeoJSONFeature,
    Geometry as GeoJSONGeometry,
} from 'geojson'

export interface Origin {
    mode: OriginMode,
    mode_id?: string
}

export enum OriginMode {
    CONNECTION = 'Connection',
    MISSION = 'Mission'
}

export const RENDERED_PROPERTIES = [
    'callsign',
    'minzoom',
    'maxzoom',
    'fill',
    'fill-opacity',
    'stroke',
    'group',
    'icon',
    'course',
    'icon-opacity',
    'stroke-opacity',
    'stroke-style',
    'stroke-width',
    'marker-color',
    'marker-stroke-color',
    'marker-radius',
    'marker-opacity',
    'circle-color',
    'circle-radius',
    'circle-opacity'
]

/**
 * MIL-STD symbols render from an icon id of the form `2525<Variant>:<SIDC>` - a
 * key into the Icon Manager's generated symbols
 *
 * It is a CloudTAK rendering detail, not TAK data: no client can resolve one as
 * an Iconset path, and an unresolvable `usericon` detail takes precedence over
 * (and so suppresses) the 2525 symbol the receiving client would otherwise
 * render from the SIDC. It is therefore never stored on a Feature - see
 * {@link renderedIcon}
 */
export const MILSYM_ICON = /^2525[bcde]:/i;

/** CoT Types with no icon in the built-in spritesheet - these render as a plain marker */
const TYPES_WITHOUT_ICON = ['u-d-p', 'b-m-p-s-m'];

/**
 * The SIDC a Feature's MIL-STD symbol should be generated from, if it has one
 *
 * `milicon` is authoritative - `type` only carries the SIDC on paths that ran
 * node-cot's `normalize2525` (mission sync & CoT query deliver `a-f-G` instead)
 */
// Features from vector overlays (KML, imported files) carry arbitrary
// properties - `type` may be absent entirely and nested objects like `milicon`
// arrive flattened to JSON strings, so validate shapes before conversion
function milsymSIDC(properties: Feature["properties"]): string | undefined {
    if (
        properties.milicon
        && typeof properties.milicon === 'object'
        && typeof properties.milicon.id === 'string'
        && Type2525.isNumericSIDCConvertable(properties.milicon.id)
    ) {
        return properties.milicon.id;
    } else if (
        typeof properties.type === 'string'
        && Type2525.isNumericSIDCConvertable(properties.type)
    ) {
        return properties.type;
    } else {
        return undefined;
    }
}

/**
 * The icon id a Feature renders with, on the map and in list views alike
 *
 * `properties.icon` holds only an icon the user picked or a TAK client sent, so
 * it wins. Everything else is derived here rather than stored: a MIL-STD symbol
 * is a pure function of the Feature's SIDC, and persisting the derived key both
 * staled it against later type edits and leaked it onto the wire as a junk
 * `usericon` iconsetpath
 */
export function renderedIcon(properties: Feature["properties"]): string | undefined {
    if (properties.icon) return properties.icon;

    // A Contact renders as its team coloured skittle. The skittle and icon map
    // layers filter on `group` and `icon` independently and neither excludes the
    // other, so deriving an icon here would draw a symbol on top of the skittle
    if (properties.group) return undefined;

    const sidc = milsymSIDC(properties);
    if (sidc) return `2525E:${sidc}`;

    // Everything else keys the built-in spritesheet off the CoT Type
    if (properties.type && !TYPES_WITHOUT_ICON.includes(properties.type)) {
        return properties.type;
    }

    return undefined;
}

const COT_MUTATIONS: COTMutation[] = [
    applyEllipseMutation
];

function applyCOTMutations(
    current: Feature,
    update: COTUpdate
): COTUpdate {
    let next = update;

    for (const mutation of COT_MUTATIONS) {
        next = mutation({ current, update: next }) || next;
    }

    return next;
}

export default class COT {
    id: string;

    instance: string;

    _path: string;
    _properties: Feature["properties"];
    _geometry: Feature["geometry"];

    _remote: boolean;

    _liveQuerySubscription: { unsubscribe: () => void } | null;

    static selfUid: string | null = null;

    _username?: string;

    origin: Origin

    static async load(
        feat: Feature,
        origin?: Origin,
        opts?: {
            skipSave?: boolean;
            remote?: boolean
        }
    ) {
        await COT.style(feat);

        return new COT(
            feat,
            origin,
            opts
        );
    }

    constructor(
        feat: Feature,
        origin?: Origin,
        opts?: {
            skipSave?: boolean;
            remote?: boolean
        }
    ) {
        this.id = feat.id || randomUUID();

        this._path = feat.path || '/';
        this._properties = feat["properties"] || {};
        this._geometry = feat["geometry"];

        this._remote = !!(opts && opts.remote === true)
        this._liveQuerySubscription = null;

        this.instance = this._remote ? `remote:${randomUUID()}` : `db:${randomUUID()}`

        this.origin = origin || { mode: OriginMode.CONNECTION };

        if (!opts || (opts && opts.skipSave !== true)) {
            this.save();
        }
    }

    /**
     * Begin listening for remote updates via a DexieDB live query
     * This is a seperate function due to the issues outlined in: https://stackoverflow.com/q/70184129
     */
    reactivity() {
        if (this._remote) {
            this._liveQuerySubscription = liveQuery(() => db.feature.get(this.id)).subscribe((feat) => {
                if (!feat) return;
                this._path = feat.path;
                Object.assign(this._properties, feat.properties);
                Object.assign(this._geometry, feat.geometry);
            });
        } else {
            throw new Error('Only Remote instances can listen for updates');
        }
    }

    set path(path: string) {
        this.update({ path });
    }

    get path() {
        return this._path;
    }

    set properties(properties: Feature["properties"]) {
        this.update({ properties });
    }

    get properties() {
        return this._properties;
    }

    set geometry(geometry: Feature["geometry"]) {
        this.update({ geometry })
    }

    get geometry() {
        return this._geometry;
    }

    /**
     * Update the COT and return a boolean as to whether the COT needs to be re-rendered
     */
    async update(
        update: COTUpdate,
        opts?: {
            skipSave?: boolean;
        }
    ): Promise<boolean> {
        update = applyCOTMutations(this.as_feature(), update);

        if (this._remote) {
            if (update.path) this._path = update.path;
            if (update.properties) this._properties = update.properties;
            if (update.geometry) this._geometry = update.geometry;

            // We do the parse/stringify to ensure that deep Proxies created with Vue3 ref/reactive are removed
            // As they cannot be Cloned accross the ComLink Bridge
            const channel = new BroadcastChannel('cloudtak');
            channel.postMessage({
                type: WorkerMessageType.Feature_Update,
                body: JSON.parse(JSON.stringify(this.as_feature()))
            });
            channel.close();

            return false;
        } else {
            if (!update.geometry && !update.properties && !update.path) {
                return false;
            }

            if (update.path) {
                this._path = update.path;
            }

            let visuallyChanged = false;
            if (update.geometry) {
                if (isEqual(this.geometry, update.geometry)) {
                    delete update.geometry;
                } else {
                    Object.assign(this._geometry, update.geometry);
                    visuallyChanged = true;
                }
            }

            if (update.properties) {
                update.properties = await COT.styleProperties(this._geometry.type, update.properties);

                if (isEqual(this.properties, update.properties)) {
                    delete update.properties
                } else {
                    const renderedBefore = renderedIcon(this._properties);

                    for (const prop of RENDERED_PROPERTIES) {
                        if (this._properties[prop] !== update.properties[prop]) {
                            visuallyChanged = true;
                            break;
                        }
                    }

                    // Object.assign cannot remove a key - a type change must drop
                    // the type-derived milicon & icon or they outrank the new type
                    // in renderedIcon and the old symbol stays on the map
                    if (update.properties.type && update.properties.type !== this._properties.type) {
                        delete this._properties.milicon;

                        if (this._properties.icon && !this._properties.icon.includes(':')) {
                            delete this._properties.icon;
                        }
                    }

                    Object.assign(this._properties, update.properties);

                    // The rendered icon derives from type/milicon which are not
                    // RENDERED_PROPERTIES themselves
                    if (renderedIcon(this._properties) !== renderedBefore) {
                        visuallyChanged = true;
                    }
                }
            }

            const updatedCenter = update.properties && Array.isArray(update.properties.center)
                ? update.properties.center
                : undefined;
            if (update.geometry || !this._properties.center || (this._properties.center[0] === 0 && this._properties.center[1] === 0)) {
                if (updatedCenter && updatedCenter.length >= 2) {
                    this._properties.center = updatedCenter;
                } else {
                    this._properties.center = pointOnFeature(this._geometry).geometry.coordinates;

                    if (this._geometry.type === 'Point' && this._geometry.coordinates.length > 2) {
                        this._properties.center[2] = this._geometry.coordinates[2];
                    }
                }
            }

            if (this.origin.mode === OriginMode.CONNECTION) {
                await withDbRetry(() => db.feature.put({
                    id: this.id,
                    path: this._path,
                    properties: this._properties,
                    geometry: this._geometry
                }));
            }

            // skipSave: true is passed when applying server state locally
            // (archive loads, sync events) - saving here would PUT the feature
            // back to the API, which re-broadcasts a sync event to the user's
            // other clients and creates a circular sync loop between them
            if (!this.is_self && (!opts || opts.skipSave !== true)) {
                await this.save();
            }

            return visuallyChanged;
        }
    }

    /**
     * Attempt to save the CoT to the database if necessary
     */
    async save(): Promise<void> {
        if (
            !this._remote
            && !this.is_self
            && this.properties.archived
            && this.origin.mode === OriginMode.CONNECTION
        ) {
            const tokenEntry = await db.config.get('token');
            if (!tokenEntry) return;

            await std('/api/profile/feature', {
                method: 'PUT',
                token: tokenEntry.value as string,
                body: this.as_feature()
            })
        }
    }

    get is_skittle(): boolean {
        return !!this.properties.group;
    }

    get is_self(): boolean {
        return COT.selfUid === this.id;
    }

    get is_route(): boolean {
        return this._geometry.type === 'LineString' && this._properties.type === 'b-m-r';
    }

    get is_archivable(): boolean {
        return !this.is_skittle;
    }

    /**
     * A machine generated feature this client didn't author (eg a Core Event
     * CoT, reposted every cycle so local edits are silently overwritten).
     * Excludes locally created features (creator entry) and Routes
     */
    get is_machine_generated(): boolean {
        return this._properties.how === 'm-g'
            && !this._properties.creator
            && !this.is_route;
    }

    /**
     * Determines if the COT type allows editing
     * But does not determine if a COT is part of a Misison Sync, if the mission allows editing
     */
    get is_editable(): boolean {
        if (this.is_self) return true;
        if (this.is_machine_generated) return false;

        return this.properties.archived || false;
    }

    /**
     * Convert this LineString feature into a TAK Route (`b-m-r`).
     * Throws if the geometry is not a LineString or the feature is already a route.
     */
    async toRoute(): Promise<void> {
        if (this._geometry.type !== 'LineString') {
            throw new Error('toRoute() is only supported for LineString features');
        }
        if (this.is_route) return;

        this._properties.type = 'b-m-r';
        this._properties.how = 'm-g';
        this._properties.archived = true;

        await this.update({});
    }

    async subscription(): Promise<Subscription> {
        if (!this.is_skittle) throw new Error('Username can only be obtained for Users');

        return (await std(`/api/marti/subscription/${this.id}`, {
            method: 'GET'
        }) as Subscription);
    }

    async username(): Promise<string> {
        if (!this.is_skittle) throw new Error('Username can only be obtained for Users');

        if (this._username) {
            return this._username;
        } else {
            try {
                this._username = (await this.subscription()).username;
            } catch (err) {
                console.error(err);
                this._username = '';
            }

            return this._username;
        }
    }

    /**
     * Returns a proxy that will correctly call the internal update function if changes are made
     * Warning: Cannot be used with Vue3's reactivity system
     */
    as_proxy(): COT {
        return new Proxy(this, {
            set(target, prop, val) {
                return Reflect.set(target, prop, val);
            },
            get(target, prop) {
                if (prop === 'properties') {
                    return new Proxy(target.properties, {
                        set(subtarget, prop, val) {
                            const res = Reflect.set(subtarget, prop, val);
                            target.update({ properties: subtarget })
                            return res;
                        }
                    })
                } else if (prop === 'geometry') {
                    return new Proxy(target.geometry, {
                        set(subtarget, prop, val) {
                            const res = Reflect.set(subtarget, prop, val);
                            target.update({ geometry: subtarget })
                            return res;
                        }
                    })
                } else {
                    return Reflect.get(target, prop);
                }
            }
        })
    }

    as_feature(opts?: {
        clone?: boolean
    }): Feature {
        const feat = {
            id: this.id,
            type: 'Feature',
            path: this._path,
            origin: this.origin,
            properties: this._properties,
            geometry: this._geometry
        } as Feature

        if (opts && opts.clone) {
            return JSON.parse(JSON.stringify(feat)) as Feature;
        } else {
            return feat;
        }
    }

    as_rendered() {
        return COT.as_rendered(this.as_feature());
    }

    /**
     * The slimmer we can get the Features, the better
     * This returns the minium feature we need to actually style the COT in the vector tiles
     */
    static as_rendered(
        input: Feature
    ): GeoJSONFeature<GeoJSONGeometry, Record<string, unknown>> {
        const feat: GeoJSONFeature<GeoJSONGeometry, Record<string, unknown>> = {
            id: this.vectorId(input.id),
            type: 'Feature',
            properties: {
                id: input.id,        //Vector Tiles only support integer IDs so store in props
                callsign: input.properties.callsign,
                path: input.path || '/',
            },
            geometry: input.geometry
        };

        if (!feat.properties) feat.properties = {};

        for (const prop of RENDERED_PROPERTIES) {
            if (input.properties[prop] !== undefined) {
                feat.properties[prop] = input.properties[prop];
            }
        }

        // The style has no access to the SIDC - it keys `icon-image` off `icon`
        // alone, so a MIL-STD symbol's generated key is supplied here
        const icon = renderedIcon(input.properties);
        if (icon !== undefined) feat.properties.icon = icon;

        return feat;
    }

    vectorId(): number {
        return COT.vectorId(this.id);
    }

    /**
     * string hash function to convert the COT ID into a number for use as a vector tile feature ID
     */
    static vectorId(id: string): number {
        let h = 0;
        if (id.length === 0) return h;
        for (let i = 0; i < id.length; i++) {
            h = (h << 5) - h + id.charCodeAt(i);
            h |= 0; // Ensure 32-bit integer
        }

        return h >>> 0; // Convert to unsigned
    }

    length(): number {
        if (this._geometry.type === 'LineString') {
            return length({
                type: 'Feature',
                properties: {},
                geometry: this._geometry
            });
        } else {
            return 0;
        }
    }

    bounds(): GeoJSONBBox {
        return bbox(this._geometry);
    }

    async flyTo(): Promise<void> {
        const channel = new BroadcastChannel('cloudtak');

        if (this.geometry.type === 'Point') {
            let zoom = 16
            if (this.properties.minzoom) {
                zoom = this.properties.minzoom;
            }

            channel.postMessage({
                type: WorkerMessageType.Map_FlyTo,
                body: {
                    center: [this.properties.center[0], this.properties.center[1]],
                    zoom,
                    speed: Infinity,
                }
            })
        } else {
            channel.postMessage({
                type: WorkerMessageType.Map_FitBounds,
                body: {
                    bounds: this.bounds(),
                    options: {
                        maxZoom: 18,
                        padding: {
                            top: 20,
                            bottom: 20,
                            left: 20,
                            right: 20
                        },
                        speed: Infinity,
                    }
                }
            })
        }

        channel.close();
    }

    static async style(
        feat: Feature
    ): Promise<Feature> {
        feat.properties = await COT.styleProperties(feat.geometry.type, feat.properties);

        if (!feat.properties.archived) {
            feat.properties.archived = false
        }

        if (!feat.properties.id) {
            feat.properties.id = feat.id;
        }

        if (!feat.properties.center || (feat.properties.center[0] === 0 && feat.properties.center[1] === 0)) {
            feat.properties.center = pointOnFeature(feat.geometry).geometry.coordinates;

            if (feat.geometry.type === 'Point' && feat.geometry.coordinates.length > 2) {
                feat.properties.center[2] = feat.geometry.coordinates[2];
            }
        }

        return feat;
    }

    /**
     * Consistent feature manipulation between add & update
     */
    static async styleProperties(
        type: string,
        properties: Feature["properties"]
    ): Promise<Feature["properties"]> {
        if (!properties.time) properties.time = new Date().toISOString();
        if (!properties.start) properties.start = new Date().toISOString();
        if (!properties.stale) {
            const currentTime = new Date();
            currentTime.setMinutes(currentTime.getMinutes() + 10);
            properties.stale = currentTime.toISOString();
        }

        if (!properties.remarks) {
            properties.remarks = 'None';
        }

        if (!properties.how && properties.type.startsWith('u-')) {
            properties.how = 'h-g-i-g-o';
        } else if (!properties.how) {
            properties.how = 'm-p';
        }

        if (type.includes('Point')) {
            if (
                properties.icon
                && (
                    properties.icon.startsWith('COT_MAPPING_2525C')
                    || properties.icon.startsWith('COT_MAPPING_2525B')
                    // Features stored before the MIL-STD render key stopped being
                    // persisted still carry one - drop it so it re-derives
                    || MILSYM_ICON.test(properties.icon)
                )
            ) {
                delete properties.icon;
            }

            if (properties.group) {
                properties['icon-opacity'] = 0;

                const markerColor = TEAM_COLORS[properties.group.name] ?? '#FFFFFF';
                properties['marker-color'] = markerColor;
                properties['marker-stroke-color'] = strokeColorFor(markerColor);
            } else if (properties.icon) {
                // Format of icon needs to change for spritesheet
                if (!properties.icon.includes(':')) {
                    properties.icon = properties.icon.replace('/', ':')
                }

                if (properties.icon.endsWith('.png')) {
                    properties.icon = properties.icon.replace(/.png$/, '');
                }
            } else if (!milsymSIDC(properties)) {
                // A MIL-STD symbol needs no icon - renderedIcon derives its key
                // from the milicon/type at render time

                // TODO Only add icon if one actually exists in the spritejson
                if (!TYPES_WITHOUT_ICON.includes(properties.type)) {
                    properties.icon = `${properties.type}`;
                }
            }
        } else if (type.includes('Line') || type.includes('Polygon')) {
            if (!properties['stroke']) properties.stroke = '#d63939';
            if (!properties['stroke-style']) properties['stroke-style'] = 'solid';
            if (!properties['stroke-width']) properties['stroke-width'] = 3;

            if (properties['stroke-opacity'] === undefined) {
                properties['stroke-opacity'] = 1;
            }

            if (type.includes('Polygon')) {
                if (!properties['fill']) properties.fill = '#d63939';

                if (properties['fill-opacity'] === undefined) {
                    properties['fill-opacity'] = 0.5;
                }
            }
        }

        return properties;
    }
}
