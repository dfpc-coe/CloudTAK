import { std } from '../../std.ts';
import { bbox } from '@turf/bbox'
import type { LngLatBoundsLike } from 'maplibre-gl';
import { useCOTStore } from '../cots.ts'
import { useProfileStore } from '../profile.ts'
import { useMapStore } from '../map.ts';
import pointOnFeature from '@turf/point-on-feature';
import type { Feature, Subscription } from './../../types.ts'
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

    _store: ReturnType<typeof useCOTStore>;
    _username?: string;

    origin: Origin

    constructor(feat: Feature, origin?: Origin) {
        feat.properties = COT.style(feat.geometry.type, feat.properties);

        this.id = feat.id || crypto.randomUUID();
        this.path = feat.path || '/';
        this._properties = feat["properties"] || {};
        this._geometry = feat["geometry"];

        this._store = useCOTStore();
        this.origin = origin || { mode: OriginMode.CONNECTION };

        if (!this._properties.archived) {
            this._properties.archived = false
        }

        if (!this._properties.center || (this._properties.center[0] === 0 && this._properties.center[1] === 0)) {
            this._properties.center = pointOnFeature(this._geometry).geometry.coordinates;
        }

        if (this.origin.mode === OriginMode.CONNECTION) {
            this._store.pending.set(this.id, this);
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

    /**
     * Update the COT and return a boolean as to whether the COT needs to be re-rendered
     */
    async update(update: {
        properties?: Feature["properties"],
        geometry?: Feature["geometry"]
    }, opts?: {
        skipSave?: boolean;
    }): Promise<boolean> {
        let visuallyChanged = false;
        if (update.geometry) {
            //TODO Detect Geometry changes, use centroid?!
            this._geometry = update.geometry;
            visuallyChanged = true;
        }

        if (update.properties) {
            update.properties = COT.style(this._geometry.type, update.properties);

            for (const prop of RENDERED_PROPERTIES) {
                if (this._properties[prop] !== update.properties[prop]) {
                    visuallyChanged = true;
                    break;
                }
            }

            Object.assign(this._properties, update.properties);
        }

        if (!this._properties.center || (this._properties.center[0] === 0 && this._properties.center[1] === 0) || update.geometry) {
            this._properties.center = pointOnFeature(this._geometry).geometry.coordinates;
        }

        // TODO only update if Geometry or Rendered Prop changes
        if (this.origin.mode === OriginMode.CONNECTION) {
            this._store.pending.set(this.id, this);
        }

        if (this.is_self) {
            const profileStore = useProfileStore();

            if (
                profileStore.profile
                && (
                    this.properties.remarks !== profileStore.profile.tak_remarks
                    || this.properties.callsign !== profileStore.profile.tak_callsign
                )
            ) {
                await profileStore.update({
                    tak_callsign: this.properties.callsign,
                    tak_remarks: this.properties.remarks
                })
            }
        } else if (!opts || (opts && !opts.skipSave)) {
            await this.save();
        }

        return visuallyChanged;
    }

    /**
     * Attempt to save the CoT to the database if necessary
     */
    async save(): Promise<void> {
        if (this.properties.archived) {
            await std('/api/profile/feature', {
                method: 'PUT',
                body: this.as_feature()
            })
        }
    }

    get is_skittle(): boolean {
        return !!this.properties.group;
    }

    get is_self(): boolean {
        const profileStore = useProfileStore();
        return this.id === profileStore.uid();
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

    flyTo() {
        const mapStore = useMapStore();
        if (!mapStore.map) return;

        mapStore.map.fitBounds(this.bounds() as LngLatBoundsLike, {
            maxZoom: 18,
            padding: {
                top: 20,
                bottom: 20,
                left: 20,
                right: 20
            },
            speed: Infinity,
        })
    }

    /**
     * Consistent feature manipulation between add & update
     */
    static style(
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

                const mapStore = useMapStore();
                if (mapStore.map && !mapStore.map.hasImage(properties.icon)) {
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
