import type {
    ProfileOverlay,
    ProfileOverlay_Create,
    TileJSON
} from '../types.ts';
import { DrawToolMode } from '../stores/modules/draw.ts';
import type { FeatureCollection } from 'geojson';
import { bbox } from '@turf/bbox'
import type { LngLatBoundsLike, LayerSpecification, VectorTileSource, RasterTileSource, GeoJSONSource } from 'maplibre-gl'
import cotStyles from './utils/styles.ts'
import { std, stdurl } from '../std.js';
import { useMapStore } from '../stores/map.js';

/**
 * @class
 */
export default class Overlay {
    _destroyed: boolean;
    _internal: boolean;

    _timer: ReturnType<typeof setInterval> | null;

    _clickable: Array<{ id: string; type: string }>;

    _error?: Error;
    _loaded: boolean;

    id: number;
    name: string;
    active: boolean;
    username?: string;
    frequency: number | null;
    created: string;
    updated: string;
    pos: number;
    type: string;
    opacity: number;
    visible: boolean;
    mode: string;
    mode_id: string | null;

    actions: ProfileOverlay["actions"];

    url?: string;
    styles: Array<LayerSpecification>;
    token: string | null;

    static async create(
        body: ProfileOverlay | ProfileOverlay_Create,
        opts: {
            internal?: boolean;
            skipSave?: boolean;
            clickable?: Array<{ id: string; type: string }>;
            before?: string;
        } = {}
    ): Promise<Overlay> {
        if (opts.skipSave !== true) {
            let ov = await std('/api/profile/overlay', {
                method: 'POST',
                body
            }) as ProfileOverlay;

            if (ov.styles && ov.styles.length) {
                for (const layer of ov.styles) {
                    const l = layer as LayerSpecification;
                    l.id = `${ov.id}-${l.id}`;
                    // @ts-expect-error Special case Background Layer type
                    l.source = String(ov.id);
                }
            }

            ov = await std(`/api/profile/overlay/${ov.id}`, {
                method: 'PATCH',
                body: ov
            }) as ProfileOverlay;

            const overlay = new Overlay(ov, {
                internal: opts.internal
            });

            await overlay.init(opts);

            return overlay;
        } else {
            const overlay = new Overlay(body as ProfileOverlay, {
                internal: opts.internal
            });

            await overlay.init(opts);

            return overlay;
        }
    }

    static async internal(
        body: {
            id: number;
            type: string;
            name: string;
            styles?: Array<LayerSpecification>;
            clickable?: Array<{ id: string; type: string }>;
        }
    ): Promise<Overlay> {
        const overlay = await Overlay.create({
            ...body,
            visible: true,
            opacity: 1,
            username: 'internal',
            url: '',
            frequency: null,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            token: undefined,
            mode: 'internal',
            mode_id: undefined,
            styles: body.styles || [],
            pos: 3,
        }, {
            skipSave: true,
            clickable: body.clickable,
            internal: true
        });

        return overlay;
    }

    static async load(id: number): Promise<Overlay> {
        const remote = await std(`/api/profile/overlay/${id}`) as ProfileOverlay;

        const ov = await Overlay.create(remote, {
            skipSave: true
        });

        return ov;
    }

    constructor(
        overlay: ProfileOverlay,
        opts: {
            internal?: boolean;
        } = {}
    ) {
        this._destroyed = false;
        this._internal = opts.internal || false;
        this._clickable = [];
        this._loaded = false;

        this.id = overlay.id;
        this.name = overlay.name;
        this.active = overlay.active;
        this.username = overlay.username;
        this.frequency = overlay.frequency;
        this.created = overlay.created;
        this.updated = overlay.updated;
        this.actions = overlay.actions || {
            feature: []
        };
        this.pos = overlay.pos;
        this.type = overlay.type;
        this.opacity = overlay.opacity;
        this.visible = overlay.visible;
        this.mode = overlay.mode;
        this.mode_id = overlay.mode_id || null;
        this.url = overlay.url;
        this.styles = overlay.styles as Array<LayerSpecification>;
        this.token = overlay.token;

        if (this.frequency) {
            this._timer = setInterval(async () => {
                const mapStore = useMapStore();
                try {
                    mapStore.map.refreshTiles(String(this.id));
                } catch (err) {
                    console.error('Error refreshing tiles for overlay', this.id, err);
                }
            }, this.frequency * 1000);
        } else {
            this._timer = null;
        }
    }

    healthy(): boolean {
        return !this._error;
    }

    hasBounds(): boolean {
        const mapStore = useMapStore();
        const source = mapStore.map.getSource(String(this.id))
        if (!source) return false;

        if (source.type === 'vector') {
            return !!(source as VectorTileSource).bounds;
        } else if (source.type === 'raster') {
            return !!(source as RasterTileSource).bounds;
        } else if (source.type === 'geojson') {
            return true;
        } else {
            return false
        }
    }

    async zoomTo(): Promise<void> {
        const mapStore = useMapStore();
        const source = mapStore.map.getSource(String(this.id))
        if (!source) return;

        if (source.type === 'vector') {
            mapStore.map.fitBounds((source as VectorTileSource).bounds);
        } else if (source.type === 'raster') {
            mapStore.map.fitBounds((source as RasterTileSource).bounds);
        } else if (source.type === 'geojson') {
            const geojson = await (source as GeoJSONSource).getData();
            mapStore.map.fitBounds(bbox(geojson) as LngLatBoundsLike);
        }
    }

    async init(opts: {
        clickable?: Array<{ id: string; type: string }>;
        before?: string;
    } = {}) {
        const mapStore = useMapStore();

        if (this.type === 'raster' && this.url) {
            const url = stdurl(this.url);
            url.searchParams.append('token', localStorage.token);

            const tileJSON = await std(url.toString()) as TileJSON

            mapStore.map.addSource(String(this.id), {
                ...tileJSON,
                type: 'raster',
            });
        } else if (this.type === 'vector' && this.url) {
            const url = stdurl(this.url);
            url.searchParams.append('token', localStorage.token);

            mapStore.map.addSource(String(this.id), {
                type: 'vector',
                url: String(url)
            });
        } else if (this.type === 'geojson') {
            if (!mapStore.map.getSource(String(this.id))) {
                const data: FeatureCollection = { type: 'FeatureCollection', features: [] };

                mapStore.map.addSource(String(this.id), {
                    type: 'geojson',
                    cluster: false,
                    data
                })
            }
        }

        const profile = await mapStore.worker.profile.load();

        let size = 8
        if (profile.display_text === 'Small') size = 4;
        if (profile.display_text === 'Large') size = 16;

        if (!this.styles.length && this.type === 'raster') {
            this.styles = [{
                'id': String(this.id),
                'type': 'raster',
                'source': String(this.id)
            }]
        } else if (!this.styles.length && this.type === 'vector') {
            this.styles = cotStyles(String(this.id), {
                sourceLayer: 'out',
                group: false,
                icons: false,
                labels: { size }
            });
        } else if (!this.styles.length && this.type === 'geojson') {
            this.styles = cotStyles(String(this.id), {
                group: this.mode !== "mission",
                icons: true,
                course: true,
                rotateIcons: profile.display_icon_rotation,
                labels: { size }
            });
        } else if (!this.styles.length) {
            this.styles = [];
        }

        if (this.type === 'vector' && this. mode !== 'basemap' && opts.clickable === undefined) {
            opts.clickable = this.styles.map((l) => {
                return { id: l.id, type: 'feat' };
            });
        } else if (this.type === 'geojson' && opts.clickable === undefined) {
            opts.clickable = this.styles.map((l) => {
                if (this.mode === 'mission') {
                    return { id: l.id, type: 'cot' };
                } else {
                    return { id: l.id, type: this.id === -1 ? 'cot' : 'feat' };
                }
            });
        }

        for (const l of this.styles) {
            if (opts.before) {
                mapStore.map.addLayer(l, opts.before);
            } else {
                mapStore.map.addLayer(l)
            }
        }

        // The above doesn't set vis/opacity initially
        this.update({
            opacity: this.opacity,
            visible: this.visible
        })

        if (!opts.clickable) {
            opts.clickable = [];
        }

        for (const click of opts.clickable) {
            const hoverIds = new Set<string>();

            mapStore.map.on('mouseenter', click.id, () => {
                if (mapStore.draw.mode !== DrawToolMode.STATIC) return;
                mapStore.map.getCanvas().style.cursor = 'pointer';
            })

            mapStore.map.on('mousemove', click.id, (e) => {
                if (mapStore.draw.mode !== DrawToolMode.STATIC) return;

                if (this.type === 'vector' && e.features) {
                    const newIds = e.features.map(f => String(f.id));

                    for (const id of hoverIds) {
                        if (newIds.includes(id)) continue;

                        mapStore.map.setFeatureState({
                            id: id,
                            source: String(this.id),
                            sourceLayer: 'out'
                        }, { hover: false });

                        hoverIds.delete(id);
                    }

                    for (const id of newIds) {
                        mapStore.map.setFeatureState({
                            id: id,
                            source: String(this.id),
                            sourceLayer: 'out'
                        }, { hover: true });

                        hoverIds.add(id);
                    }
                }
            });

            mapStore.map.on('mouseleave', click.id, () => {
                if (mapStore.draw.mode !== DrawToolMode.STATIC) return;
                mapStore.map.getCanvas().style.cursor = '';

                if (this.type === 'vector') {
                    for (const id of hoverIds) {
                        mapStore.map.setFeatureState({
                            id: id,
                            source: String(this.id),
                            sourceLayer: 'out'
                        }, { hover: false });
                    }

                    hoverIds.clear()
                }
            })
        }

        this._clickable = opts.clickable;
        this._loaded = true;
    }

    remove() {
        const mapStore = useMapStore();

        for (const l of this.styles) {
            mapStore.map.removeLayer(String(l.id));
        }

        if (mapStore.map.getStyle().sources[String(this.id)]) {
            // Don't crash the map if it already  removed
            mapStore.map.removeSource(String(this.id));
        }
    }

    async replace(
        overlay: {
            name?: string
            active?: boolean;
            username?: string
            actions?: ProfileOverlay["actions"];
            type?: string;
            opacity?: number;
            visible?: boolean;
            mode?: string;
            mode_id?: string;
            url?: string;
            token?: string;
            styles?: Array<LayerSpecification>;
        },
        opts: {
            before?: string;
        } = {}
    ): Promise<void> {
        this.remove();

        if (overlay.name) this.name = overlay.name;
        if (overlay.active !== undefined) this.active = overlay.active;
        if (overlay.username) this.username = overlay.username;
        if (overlay.actions) this.actions = overlay.actions || { feature: [] };
        if (overlay.type) this.type = overlay.type;
        if (overlay.opacity) this.opacity = overlay.opacity;
        if (overlay.visible) this.visible = overlay.visible;
        if (overlay.mode) this.mode = overlay.mode;
        if (overlay.mode_id) this.mode_id = overlay.mode_id || null;
        if (overlay.url) this.url = overlay.url;
        if (overlay.token) this.token = overlay.token;
        if (overlay.styles) {
            if (overlay.styles && overlay.styles.length) {
                for (const layer of overlay.styles) {
                    const l = layer as LayerSpecification;
                    l.id = `${this.id}-${l.id}`;
                    // @ts-expect-error Special case Background Layer type
                    l.source = String(this.id);
                }
            }
            this.styles = overlay.styles as Array<LayerSpecification>;
        }

        await this.init({
            clickable: this._clickable,
            before: opts.before
        });

        await this.save();


        // Update attribution if this is a basemap
        if (this.mode === 'basemap') {
            const mapStore = useMapStore();
            await mapStore.updateAttribution();
        }
    }

    async delete(): Promise<void> {
        this._destroyed = true;

        const wasBasemap = this.mode === 'basemap';

        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }

        this.remove();

        if (this._internal) return;

        if (this.id) {
            await std(`/api/profile/overlay?id=${this.id}`, {
                method: 'DELETE'
            });
        }

        // Update attribution if this was a basemap
        if (wasBasemap) {
            const mapStore = useMapStore();
            await mapStore.updateAttribution();
        }
    }

    async update(body: {
        pos?: number;
        visible?: boolean;
        opacity?: number;
    }): Promise<void> {
        const mapStore = useMapStore();

        if (body.opacity !== undefined) {
            this.opacity = body.opacity;
            for (const l of this.styles) {
                if (this.type === 'raster') {
                    mapStore.map.setPaintProperty(l.id, 'raster-opacity', Number(this.opacity))
                }
            }
        }

        if (body.visible !== undefined) {
            this.visible = body.visible;
            for (const l of this.styles) {
                mapStore.map.setLayoutProperty(l.id, 'visibility', this.visible ? 'visible' : 'none');
            }
        }

        // Update attribution if this is a basemap
        if (this.mode === 'basemap') {
            await mapStore.updateAttribution();
        }

        if (body.pos !== undefined) {
            this.pos = body.pos;
        }

        await this.save();
    }

    async save(): Promise<void> {
        if (this._destroyed) throw new Error('Cannot save a destroyed layer');
        if (this._internal) return;

        // We want to just use the default style every time for things like missions
        // We only want to save the style on custom datasources
        const dropStyles = ['mission', 'internal'].includes(this.mode);

        await std(`/api/profile/overlay/${this.id}`, {
            method: 'PATCH',
            body: {
                pos: this.pos,
                name: this.name,
                type: this.type,
                active: this.active,
                opacity: this.opacity,
                mode_id: this.mode_id,
                url: this.url,
                visible: this.visible,
                styles: dropStyles ? [] : this.styles
            }
        })
    }
}
