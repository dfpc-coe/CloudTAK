import { std } from '../std.ts';
import { sector } from '@turf/sector';
import { bbox } from '@turf/bbox'
import { isEqual } from '@react-hookz/deep-equal';
import { WorkerMessageType } from'./events.ts'
import type { Remote } from 'comlink';
import type Atlas from '../workers/atlas.ts';
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
    'fill',
    'fill-opacity',
    'stroke',
    'group',
    'icon',
    'course',
    'icon-opacity',
    'stroke-opacity',
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
    path: string;

    _properties: Feature["properties"];
    _geometry: Feature["geometry"];

    _remote: BroadcastChannel | null;

    _atlas: Atlas | Remote<Atlas>;

    _username?: string;

    origin: Origin

    links: Set<string>;

    constructor(
        atlas: Atlas | Remote<Atlas>,
        feat: Feature,
        origin?: Origin,
        opts?: {
            skipSave?: boolean;
            remote?: BroadcastChannel | null;
        }
    ) {
        if (!opts || (opts && !opts.remote)) {
            const a = atlas as Atlas;
            // Remote properties will already have the default style applied
            feat.properties = COT.style(a, feat.geometry.type, feat.properties);
        }

        this.id = feat.id || crypto.randomUUID();
        this.path = feat.path || '/';
        this._properties = feat["properties"] || {};
        this._geometry = feat["geometry"];

        this._remote = (opts && opts.remote !== undefined) ? opts.remote : null;
        this._atlas = atlas;

        this.origin = origin || { mode: OriginMode.CONNECTION };

        this.links = new Set();

        if (!this._properties.archived) {
            this._properties.archived = false
        }

        if (!this._properties.center || (this._properties.center[0] === 0 && this._properties.center[1] === 0)) {
            this._properties.center = pointOnFeature(this._geometry).geometry.coordinates;
        }

        if (this.origin.mode === OriginMode.CONNECTION && !this._remote) {
            const atlas = this._atlas as Atlas;

            if (!atlas.db.cots.has(this.id)) {
                atlas.db.pendingCreate.set(this.id, this);
            } else {
                atlas.db.pendingUpdate.set(this.id, this);
            }

            atlas.db.cots.set(this.id, this);
        }

        if (!this._remote && this._properties.sensor) {
            this.link();
        }

        if (!opts || (opts && opts.skipSave !== true)) {
            this.save();
        }

        if (this._remote) {
            const atlas = this._atlas as Remote<Atlas>;

            // The sync BroadcastChannel will post a message anytime the underlying
            // Atlas database has a COT update, resulting in a sync with the frontend
            this._remote.onmessage = async (ev) => {
                if (ev.data === `cot:${this.id}`) {
                    const feat = await atlas.db.get(this.id)
                    if (feat) {
                        this._properties = feat.properties;
                        this._geometry = feat.geometry;
                    }
                }
            };
        }
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

    link(): void {
        if (this._remote) throw new Error('Cannot Link Remotely');

        const atlas = this._atlas as Atlas;

        if (
            this._properties.sensor
            && this._properties.sensor.fov !== undefined
            && this._properties.sensor.azimuth !== undefined
        ) {
            const id = `${this.id}-sensor`

            let updated = false;

            if (this.links.has(id)) {
                const cot = atlas.db.cots.get(id);
                if (cot) {
                    updated = true;

                    cot.geometry = sector(
                        this._properties.center,
                        (this._properties.sensor.range || 10) / 1000,
                        this._properties.sensor.azimuth,
                        this._properties.sensor.azimuth + this._properties.sensor.fov,
                    ).geometry
                }
            }

            if (!updated) {
                // TODO Use NodeCoT & Respect Sensor Style if present
                new COT(
                    atlas,
                    {
                        id,
                        path: '/',
                        type: 'Feature',
                        properties: {
                            id,
                            callsign: '',
                            type: 'u-d-p',
                            how: this._properties.how,
                            center: this._properties.center,
                            stroke: '#ffffff',
                            time: this._properties.time,
                            start: this._properties.start,
                            stale: this._properties.stale,
                            'stroke-width': 1,
                            'stroke-opacity': 1,
                            fill: '#ffffff',
                            'fill-opacity': 0.2
                        },
                        geometry: sector(
                            this._properties.center,
                            (this._properties.sensor.range || 10) / 1000,
                            this._properties.sensor.azimuth,
                            this._properties.sensor.azimuth + this._properties.sensor.fov,
                        ).geometry
                    }
                );

                this.links.add(id)
            }
        }
    }

    /**
     * Update the COT and return a boolean as to whether the COT needs to be re-rendered
     */
    async update(update: {
        properties?: Feature["properties"],
        geometry?: Feature["geometry"]
    }, opts?: {
        skipSave?: boolean;
    }): Promise<boolean> {
        if (this._remote) {
            const atlas = this._atlas as Remote<Atlas>;
            await atlas.db.add(this.as_feature());

            return false;
        } else {
            const atlas = this._atlas as Atlas;

            let visuallyChanged = false;
            if (update.geometry) {
                if (isEqual(this.geometry, update.geometry)) {
                    delete update.geometry;
                } else {
                    Object.assign(this._geometry, update.geometry);
                    visuallyChanged = true;
                }
            }

            this._properties = update.properties;

            if (update.properties) {
                if (update.properties.sensor) {
                    this.link();
                } else if (this._properties.sensor && !update.properties.sensor) {
                    // TODO Unlink & cleanup
                }

                update.properties = COT.style(atlas, this._geometry.type, update.properties);

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

            if (!update.geometry && !update.properties) {
                return false;
            }

            if (update.geometry || !this._properties.center || (this._properties.center[0] === 0 && this._properties.center[1] === 0)) {
                this._properties.center = pointOnFeature(this._geometry).geometry.coordinates;
            }

            if (this.origin.mode === OriginMode.CONNECTION) {
                atlas.db.pendingUpdate.set(this.id, this);
            }

            atlas.sync.postMessage(`cot:${this.id}`);

            if (this.is_self) {
                const getProfile = await atlas.profile.profile;

                const profile = getProfile instanceof Promise ? await getProfile : getProfile;

                if (
                    profile
                    && (
                        this.properties.remarks !== profile.tak_remarks
                        || this.properties.callsign !== profile.tak_callsign
                    )
                ) {
                    await atlas.profile.update({
                        tak_callsign: this.properties.callsign,
                        tak_remarks: this.properties.remarks
                    })
                }
            } else if (!opts || (opts && opts.skipSave !== false)) {
                await this.save();
            }

            return visuallyChanged;
        }
    }

    /**
     * Attempt to save the CoT to the database if necessary
     */
    async save(): Promise<void> {
        if (!this._remote && !this.is_self && this.properties.archived) {
            const atlas = this._atlas as Atlas;

            await std('/api/profile/feature', {
                method: 'PUT',
                token: atlas.token,
                body: this.as_feature()
            })
        }
    }

    get is_skittle(): boolean {
        return !!this.properties.group;
    }

    get is_self(): boolean {
        if (this._atlas) {
            return this._atlas.profile.uid() === this.id;
        } else {
            return false;
        }
    }

    get is_archivable(): boolean {
        return !this.is_skittle;
    }

    get is_editable(): boolean {
        if (this.origin.mode === OriginMode.MISSION) {
            // TODO Check role and allow editing if role allows & also auto update mission with edited CoT
            return false;
        } else {
            return this.properties.archived || this.is_self || false;
        }
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
            path: this.path,
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

    /**
     * The slimmer we can get the Features, the better
     * This returns the minium feature we need to actually style the COT in the vector tiles
     */
    as_rendered(): GeoJSONFeature<GeoJSONGeometry, Record<string, unknown>> {
        const feat: GeoJSONFeature<GeoJSONGeometry, Record<string, unknown>> = {
            id: this.id,
            type: 'Feature',
            properties: {
                id: this.id,        //Vector Tiles only support integer IDs so store in props
                callsign: this._properties.callsign,
            },
            geometry: this._geometry
        };

        if (!feat.properties) feat.properties = {};

        for (const prop of RENDERED_PROPERTIES) {
            if (this._properties[prop] !== undefined) {
                feat.properties[prop] = this._properties[prop];
            }
        }

        return feat;
    }

    bounds(): GeoJSONBBox {
        return bbox(this._geometry);
    }

    async flyTo(): Promise<void> {
        await this._atlas.postMessage({
            type: WorkerMessageType.Map_FlyTo,
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

    /**
     * Consistent feature manipulation between add & update
     */
    static style(
        atlas: Atlas,
        type: string,
        properties: Feature["properties"]
    ): Feature["properties"] {
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


                if (!atlas.db.images.has(properties.icon)) {
                    console.warn(`No Icon for: ${properties.icon} fallback to ${properties.type}`);
                    properties.icon = `${properties.type}`;
                }
            } else {
                // TODO Only add icon if one actually exists in the spritejson
                if (!['u-d-p'].includes(properties.type)) {
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
