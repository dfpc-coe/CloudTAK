import type {
    ProfileOverlay,
    ProfileOverlay_Create
} from '../../types.ts';
import type { FeatureCollection } from 'geojson';
import mapgl from 'maplibre-gl'
import type { LayerSpecification } from 'maplibre-gl'
import cotStyles from './styles.ts'
import { std, stdurl } from '../../std.js';

/**
 * @class
 */
export default class Overlay {
    _map: mapgl.Map;
    _destroyed: boolean;
    _internal: boolean;

    _layers: Array<LayerSpecification>;
    _clickable: Array<{ id: string; type: string }>;

    id: number;
    name: string;
    username?: string;
    created: string;
    updated: string;
    pos: number;
    type: string;
    opacity: number;
    visible: boolean;
    mode: string;
    mode_id: string | null;
    url?: string;
    styles: any;
    token: string | null;

    static async create(
        map: mapgl.Map,
        body: ProfileOverlay_Create,
        opts: {
            layers?: Array<LayerSpecification>;
            clickable?: Array<{ id: string; type: string }>;
        } = {}
    ): Promise<Overlay> {
        const ov = await std('/api/profile/overlay', { method: 'POST', body });
        return new Overlay(map, ov, opts);
    }

    static internal(
        map: mapgl.Map,
        body: {
            id: number;
            type: string;
            name: string;
        },
        opts: {
            layers?: Array<LayerSpecification>;
            clickable?: Array<{ id: string; type: string }>;
        } = {}
    ): Overlay {
        const overlay = new Overlay(map, {
            ...body,
            visible: true,
            opacity: 1,
            username: 'internal',
            url: '',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            token: null,
            mode: 'internal',
            mode_id: null,
            styles: {},
            pos: 3,
        }, {
            ...opts,
            internal: true
        });

        return overlay;
    }

    static async load(map: mapgl.Map, id: number): Promise<Overlay> {
        const overlay = await std(`/api/profile/overlay/${id}`);
        return new Overlay(map, overlay as ProfileOverlay);
    }

    constructor(map: mapgl.Map, overlay: ProfileOverlay, opts: {
        layers?: Array<LayerSpecification>;
        clickable?: Array<{ id: string; type: string }>;
        internal?: boolean;
        before?: string;
    } = {}) {
        this._map = map;

        this._destroyed = false;
        this._internal = opts.internal || false;
        this._layers = [];
        this._clickable = [];

        this.id = overlay.id;
        this.name = overlay.name;
        this.username = overlay.username;
        this.created = overlay.created;
        this.updated = overlay.updated;
        this.pos = overlay.pos;
        this.type = overlay.type;
        this.opacity = overlay.opacity;
        this.visible = overlay.visible;
        this.mode = overlay.mode;
        this.mode_id = overlay.mode_id;
        this.url = overlay.url;
        this.styles = overlay.styles;
        this.token = overlay.token;

        this.init(opts);
    }

    init(opts: {
        layers?: Array<LayerSpecification>;
        clickable?: Array<{ id: string; type: string }>;
        before?: string;
    } = {}) {
        if (this.type ==='raster' && this.url) {
            const url = stdurl(this.url);
            url.searchParams.append('token', localStorage.token);

            this._map.addSource(String(this.id), {
                type: 'raster',
                url: String(url)
            });
        } else if (this.type === 'vector' && this.url) {
            const url = stdurl(this.url);
            url.searchParams.append('token', localStorage.token);

            this._map.addSource(String(this.id), {
                type: 'vector',
                url: String(url)
            });
        } else if (this.type === 'geojson') {
            if (!this._map.getSource(String(this.id))) {
                let data: FeatureCollection = { type: 'FeatureCollection', features: [] };

                this._map.addSource(String(this.id), {
                    type: 'geojson',
                    cluster: false,
                    data
                })
            }
        }

        if (!opts.layers && this.type === 'raster') {
            opts.layers =  [{
                'id': String(this.id),
                'type': 'raster',
                'source': String(this.id)
            }]
        } else if (!opts.layers && this.type === 'vector') {
            opts.layers = cotStyles(String(this.id), {
                sourceLayer: 'out',
                group: false,
                icons: false,
                labels: true
            });

            if (opts.clickable === undefined)  {
                opts.clickable = opts.layers.map((l) => {
                    return { id: l.id, type: 'feat' };
                });
            }
        } else if (!opts.layers && this.type === 'geojson') {
            opts.layers = cotStyles(String(this.id), {
                group: this.mode !== "mission",
                icons: true,
                labels: true
            });

            if (opts.clickable === undefined)  {
                opts.clickable = opts.layers.map((l) => {
                    return { id: l.id, type: this.id === -1 ? 'cot' : 'feat' };
                });
            }
        } else if (!opts.layers) {
            opts.layers = [];
        }

        for (const l of opts.layers) {
            if (opts.before) {
                this._map.addLayer(l, opts.before);
            } else {
                this._map.addLayer(l)
            }
        }

        this._layers = opts.layers;

        // The above doesn't set vis/opacity initially
        this.update({
            opacity: this.opacity,
            visible: this.visible
        })

        if (!opts.clickable) {
            opts.clickable = [];
        }

        for (const click of opts.clickable) {
            this._map.on('mouseenter', click.id, () => {
                this._map.getCanvas().style.cursor = 'pointer';
            })
            this._map.on('mouseleave', click.id, () => {
                this._map.getCanvas().style.cursor = '';
            })
        }

        this._clickable = opts.clickable;
    }

    remove() {
        for (const l of this._layers) {
            this._map.removeLayer(String(l.id));
        }

        this._map.removeSource(String(this.id));
    }

    async replace(body: {
        name?: string;
        url: string;
        mode_id: string;
    }): Promise<void> {
        this.name = body.name || this.name;
        this.url = body.url;
        this.mode_id = body.mode_id;

        this.remove();
        this.init({
            layers: this._layers,
            clickable: this._clickable
        });

        await this.save();
    }

    async delete(): Promise<void> {
        this._destroyed = true;

        this.remove();

        if (this._internal) return;

        if (this.id) {
            const overlay = await std(`/api/profile/overlay?id=${this.id}`, {
                method: 'DELETE'
            });
        }
    }

    async update(body: {
        pos?: number;
        visible?: boolean;
        opacity?: number;
    }): Promise<void> {
        if (body.opacity !== undefined) {
            this.opacity = body.opacity;
            for (const l of this._layers) {
                if (this.type === 'raster') {
                    this._map.setPaintProperty(l.id, 'raster-opacity', Number(this.opacity))
                }
            }
        }

        if (body.visible !== undefined) {
            this.visible = body.visible;
            for (const l of this._layers) {
                this._map.setLayoutProperty(l.id, 'visibility', this.visible ? 'visible' : 'none');
            }
        }

        if (body.pos !== undefined) {
            this.pos = body.pos;
        }

        await this.save();
    }

    async save(): Promise<void> {
        if (this._destroyed) throw new Error('Cannot save a destroyed layer');
        if (this._internal) return;

        const overlay = await std(`/api/profile/overlay/${this.id}`, {
            method: 'PATCH',
            body: {
                pos: this.pos,
                name: this.name,
                opacity: this.opacity,
                mode_id: this.mode_id,
                url: this.url,
                visible: this.visible,
                styles: this.styles
            }
        }) as ProfileOverlay;
    }
}
