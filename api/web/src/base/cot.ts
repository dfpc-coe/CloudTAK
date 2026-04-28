import { v4 as randomUUID } from 'uuid';
import { std } from '../std.ts';
import { db } from './database.ts';
import { liveQuery } from 'dexie';
import { bbox } from '@turf/bbox'
import { length } from '@turf/length'
import { isEqual } from '@ver0/deep-equal';
import { WorkerMessageType } from'./events.ts'
import pointOnFeature from '@turf/point-on-feature';
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
    'marker-radius',
    'marker-opacity',
    'circle-color',
    'circle-radius',
    'circle-opacity'
]

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
        update: {
            path?: string,
            properties?: Feature["properties"],
            geometry?: Feature["geometry"]
        },
        opts?: {
            skipSave?: boolean;
        }
    ): Promise<boolean> {
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
                    for (const prop of RENDERED_PROPERTIES) {
                        if (this._properties[prop] !== update.properties[prop]) {
                            visuallyChanged = true;
                            break;
                        }
                    }

                    Object.assign(this._properties, update.properties);
                }
            }

            if (update.geometry || !this._properties.center || (this._properties.center[0] === 0 && this._properties.center[1] === 0)) {
                this._properties.center = pointOnFeature(this._geometry).geometry.coordinates;
            }

            if (this.origin.mode === OriginMode.CONNECTION) {
                await db.feature.put({
                    id: this.id,
                    path: this._path,
                    properties: this._properties,
                    geometry: this._geometry
                });
            }

            if (!this.is_self && (!opts || (opts && opts.skipSave !== false))) {
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

    get is_archivable(): boolean {
        return !this.is_skittle;
    }

    /**
     * Determines if the COT type allows editing
     * But does not determine if a COT is part of a Misison Sync, if the mission allows editing
     */
    get is_editable(): boolean {
        return this.properties.archived || this.is_self || false;
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
            },
            geometry: input.geometry
        };

        if (!feat.properties) feat.properties = {};

        for (const prop of RENDERED_PROPERTIES) {
            if (input.properties[prop] !== undefined) {
                feat.properties[prop] = input.properties[prop];
            }
        }

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
            if (properties.group) {
                properties['icon-opacity'] = 0;

                if (properties.group.name === 'Yellow') {
                    properties["marker-color"] = '#f59f00';
                } else if (properties.group.name === 'Orange') {
                    properties["marker-color"] = '#f76707';
                } else if (properties.group.name === 'Magenta') {
                    properties["marker-color"] = '#ea4c89';
                } else if (properties.group.name === 'Red') {
                    properties["marker-color"] = '#d63939';
                } else if (properties.group.name === 'Maroon') {
                    properties["marker-color"] = '#bd081c';
                } else if (properties.group.name === 'Purple') {
                    properties["marker-color"] = '#ae3ec9';
                } else if (properties.group.name === 'Dark Blue') {
                    properties["marker-color"] = '#0054a6';
                } else if (properties.group.name === 'Blue') {
                    properties["marker-color"] = '#4299e1';
                } else if (properties.group.name === 'Cyan') {
                    properties["marker-color"] = '#17a2b8';
                } else if (properties.group.name === 'Teal') {
                    properties["marker-color"] = '#0ca678';
                } else if (properties.group.name === 'Green') {
                    properties["marker-color"] = '#74b816';
                } else if (properties.group.name === 'Dark Green') {
                    properties["marker-color"] = '#2fb344';
                } else if (properties.group.name === 'Brown') {
                    properties["marker-color"] = '#dc4e41';
                } else {
                    properties["marker-color"] = '#ffffff';
                }
            } else if (properties.icon) {
                // Format of icon needs to change for spritesheet
                if (!properties.icon.includes(':')) {
                    properties.icon = properties.icon.replace('/', ':')
                }

                if (properties.icon.endsWith('.png')) {
                    properties.icon = properties.icon.replace(/.png$/, '');
                }

                // Resolution happens via MapLibre's `styleimagemissing` handler
                // (see IconManager.onStyleImageMissing). Iconset icons are
                // loaded from Dexie on demand and unknown ids fall back to a
                // generic point bitmap, so no preflight check is required.
            } else if (properties.milsym && !isNaN(Number(properties.milsym.id))) {
                properties.icon = `2525D:${properties.milsym.id}`;
            } else {
                // TODO Only add icon if one actually exists in the spritejson
                if (!['u-d-p', 'b-m-p-s-m'].includes(properties.type)) {
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
