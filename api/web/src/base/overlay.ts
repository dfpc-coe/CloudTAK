import type {
    ProfileOverlay,
    ProfileOverlay_Create,
    TileJSON
} from '../types.ts';
import { DrawToolMode } from '../stores/modules/draw.ts';
import IconManager from '../stores/modules/icons.ts';
import type { FeatureCollection } from 'geojson';
import { bbox } from '@turf/bbox'
import type { LngLatBoundsLike, LayerSpecification, VectorTileSource, RasterTileSource, GeoJSONSource, Map as MapGLMap } from 'maplibre-gl'
import cotStyles from './utils/styles.ts'
import { std, stdurl } from '../std.js';
import ProfileConfig from './profile.ts';

export interface IDrawTool {
    mode: DrawToolMode;
}

/**
 * @class
 */
export default class Overlay {
    _destroyed: boolean;
    _internal: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _map?: MapGLMap;

    _timer: ReturnType<typeof setInterval> | null;

    _clickable: Array<{ id: string; type: string }>;

    _error?: Error;
    _loaded: boolean;

    id: number;
    name: string;
    active: boolean;
    username?: string;
    frequency: number | null;
    iconset: string | null;
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
        map: MapGLMap,
        icons: IconManager,
        draw: IDrawTool,
        body: ProfileOverlay | ProfileOverlay_Create,
        opts: {
            internal?: boolean;
            skipSave?: boolean;
            clickable?: Array<{ id: string; type: string }>;
            before?: string;
            skipLayers?: boolean;
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

            await overlay.init(map, icons, draw, opts);

            return overlay;
        } else {
            const overlay = new Overlay(body as ProfileOverlay, {
                internal: opts.internal
            });

            await overlay.init(map, icons, draw, opts);

            return overlay;
        }
    }

    static async internal(
        map: MapGLMap,
        icons: IconManager,
        draw: IDrawTool,
        body: {
            id: number;
            type: string;
            name: string;
            styles?: Array<LayerSpecification>;
            clickable?: Array<{ id: string; type: string }>;
        }
    ): Promise<Overlay> {
        const overlay = await Overlay.create(map, icons, draw, {
            ...body,
            visible: true,
            opacity: 1,
            username: 'internal',
            url: '',
            frequency: null,
            iconset: null,
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

    static async load(map: MapGLMap, icons: IconManager, draw: IDrawTool, id: number): Promise<Overlay> {
        const remote = await std(`/api/profile/overlay/${id}`) as ProfileOverlay;

        const ov = await Overlay.create(map, icons, draw, remote, {
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
        this.iconset = overlay.iconset;
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
                if (this._map) {
                    try {
                        this._map.refreshTiles(String(this.id));
                    } catch (err) {
                        console.error('Error refreshing tiles for overlay', this.id, err);
                    }
                }
            }, this.frequency * 1000);
        } else {
            this._timer = null;
        }
    }

    healthy(): boolean {
        return !this._error;
    }

    hasBounds(map: MapGLMap): boolean {
        const source = map.getSource(String(this.id))
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

    async zoomTo(map: MapGLMap): Promise<void> {
        const source = map.getSource(String(this.id))
        if (!source) return;

        if (source.type === 'vector') {
            map.fitBounds((source as VectorTileSource).bounds);
        } else if (source.type === 'raster') {
            map.fitBounds((source as RasterTileSource).bounds);
        } else if (source.type === 'geojson') {
            const geojson = await (source as GeoJSONSource).getData();
            map.fitBounds(bbox(geojson) as LngLatBoundsLike);
        }
    }

    async addLayers(map: MapGLMap, draw: IDrawTool, before?: string): Promise<void> {
        for (const l of this.styles) {
            if (before) {
                map.addLayer(l, before);
            } else {
                map.addLayer(l)
            }
        }

        // The above doesn't set vis/opacity initially
        await this.update(map, {
            opacity: this.opacity,
            visible: this.visible
        })

        for (const click of this._clickable) {
            const hoverIds = new Set<string>();

            map.on('mouseenter', click.id, () => {
                if (draw.mode !== DrawToolMode.STATIC) return;
                map.getCanvas().style.cursor = 'pointer';
            })

            map.on('mousemove', click.id, (e) => {
                if (draw.mode !== DrawToolMode.STATIC) return;

                if (this.type === 'vector' && e.features) {
                    const newIds = e.features.map(f => String(f.id));

                    for (const id of hoverIds) {
                        if (newIds.includes(id)) continue;

                        map.setFeatureState({
                            id: id,
                            source: String(this.id),
                            sourceLayer: 'out'
                        }, { hover: false });

                        hoverIds.delete(id);
                    }

                    for (const id of newIds) {
                        map.setFeatureState({
                            id: id,
                            source: String(this.id),
                            sourceLayer: 'out'
                        }, { hover: true });

                        hoverIds.add(id);
                    }
                }
            });

            map.on('mouseleave', click.id, () => {
                if (draw.mode !== DrawToolMode.STATIC) return;
                map.getCanvas().style.cursor = '';

                if (this.type === 'vector') {
                    for (const id of hoverIds) {
                        map.setFeatureState({
                            id: id,
                            source: String(this.id),
                            sourceLayer: 'out'
                        }, { hover: false });
                    }

                    hoverIds.clear()
                }
            })
        }
    }

    async init(map: MapGLMap, icons: IconManager, draw: IDrawTool, opts: {
        clickable?: Array<{ id: string; type: string }>;
        before?: string;
        skipLayers?: boolean;
    } = {}) {
        this._map = map;

        if (this.type === 'raster' && this.url) {
            const url = stdurl(this.url);
            url.searchParams.append('token', localStorage.token);

            const tileJSON = await std(url.toString()) as TileJSON

            map.addSource(String(this.id), {
                ...tileJSON,
                type: 'raster',
            });
        } else if (this.type === 'vector' && this.url) {
            const url = stdurl(this.url);
            url.searchParams.append('token', localStorage.token);

            map.addSource(String(this.id), {
                type: 'vector',
                url: String(url)
            });
        } else if (this.type === 'geojson') {
            if (!map.getSource(String(this.id))) {
                const data: FeatureCollection = { type: 'FeatureCollection', features: [] };

                map.addSource(String(this.id), {
                    type: 'geojson',
                    cluster: false,
                    data
                })
            }
        }

        const display_text = (await ProfileConfig.get('display_text'))?.value;
        const display_icon_rotation = (await ProfileConfig.get('display_icon_rotation'))?.value;

        let size = 8
        if (display_text === 'Small') size = 4;
        if (display_text === 'Large') size = 16;

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
                icons: !!this.iconset,
                labels: { size }
            });
        } else if (!this.styles.length && this.type === 'geojson') {
            this.styles = cotStyles(String(this.id), {
                group: this.mode !== "mission",
                icons: true,
                course: true,
                rotateIcons: display_icon_rotation,
                labels: { size }
            });
        } else if (!this.styles.length) {
            this.styles = [];
        }

        if (this.iconset) {
            try {
                icons.addIconset(this.iconset);
            } catch (err) {
                console.error('Error adding iconset', this.iconset, err);
            }
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

        if (!opts.clickable) {
            opts.clickable = [];
        }

        this._clickable = opts.clickable;

        if (!opts.skipLayers) {
            await this.addLayers(map, draw, opts.before);
        }
        this._loaded = true;
    }

    remove(map: MapGLMap, icons: IconManager) {
        for (const l of this.styles) {
            if (map.getLayer(String(l.id))) {
                 map.removeLayer(String(l.id));
            }
        }

        if (this.iconset) {
            icons.removeIconset(this.iconset);
        }

        if (map.getStyle().sources[String(this.id)]) {
            // Don't crash the map if it already  removed
            map.removeSource(String(this.id));
        }
    }

    async replace(
        map: MapGLMap,
        icons: IconManager,
        draw: IDrawTool,
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
        } = {},
        updateAttribution?: () => Promise<void>
    ): Promise<void> {
        this.remove(map, icons);

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

        await this.init(map, icons, draw, {
            clickable: this._clickable,
            before: opts.before
        });

        await this.save();


        // Update attribution if this is a basemap
        if (this.mode === 'basemap' && updateAttribution) {
            await updateAttribution();
        }
    }

    async delete(map: MapGLMap, icons: IconManager, updateAttribution?: () => Promise<void>): Promise<void> {
        this._destroyed = true;

        const wasBasemap = this.mode === 'basemap';

        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }

        this.remove(map, icons);

        if (this._internal) return;

        if (this.id) {
            await std(`/api/profile/overlay?id=${this.id}`, {
                method: 'DELETE'
            });
        }

        // Update attribution if this was a basemap
        if (wasBasemap && updateAttribution) {
            await updateAttribution();
        }
    }

    async update(map: MapGLMap, body: {
        pos?: number;
        visible?: boolean;
        opacity?: number;
    }, updateAttribution?: () => Promise<void>): Promise<void> {

        if (body.opacity !== undefined) {
            this.opacity = body.opacity;
            for (const l of this.styles) {
                if (this.type === 'raster') {
                    map.setPaintProperty(l.id, 'raster-opacity', Number(this.opacity))
                }
            }
        }

        if (body.visible !== undefined) {
            this.visible = body.visible;
            for (const l of this.styles) {
                map.setLayoutProperty(l.id, 'visibility', this.visible ? 'visible' : 'none');
            }
        }

        // Update attribution if this is a basemap
        if (this.mode === 'basemap' && updateAttribution) {
            await updateAttribution();
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
