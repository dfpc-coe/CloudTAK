import type {
    Map,
    LayerSpecification,
    ProfileOverlay,
    ProfileOverlay_Create
} from '../../types.ts';
import { std, stdurl } from '../../std.js';

/**
 * @class
 */
export default class Overlay {
    _map: Map;
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

    static async create(map: Map, body: ProfileOverlay_Create): Promise<Overlay> {
        const ov = await std('/api/profile/overlay', { method: 'POST', body });
        return new Overlay(map, ov);
    }

    static internal(
        map: Map,
        body: {
            id: number;
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
            type: 'geojson',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            pos: 3,
        }, opts);

        return overlay;
    }

    static async load(map: Map, id: number): Promise<Overlay> {
        const overlay = await std(`/api/profile/overlay/${id}`);
        return new Overlay(map, overlay as ProfileOverlay);
    }

    constructor(map: Map, overlay: ProfileOverlay, opts: {
        layers?: Array<LayerSpecification>;
        clickable?: Array<{ id: string; type: string }>;
    } = {}) {
        this._map = map;

        this._destroyed = false;
        this._internal = false;

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

        if (this.type ==='raster' && this.url) {
            const url = stdurl(this.url);
            url.searchParams.append('token', localStorage.token);

            this._map.addSource(this.id, {
                type: 'raster',
                url: String(url)
            });
        } else if (this.type === 'vector' && this.url) {
            const url = stdurl(this.url);
            url.searchParams.append('token', localStorage.token);

            this._map.addSource(this.id, {
                type: 'vector',
                url: String(url)
            });
        } else if (this.type === 'geojson') {
            if (!this._map.getSource(this.id)) {
                let data: FeatureCollection = { type: 'FeatureCollection', features: [] };
                if (this.mode === 'mission' && this.mode_id) {
                    //data = await cotStore.loadMission(this.mode_id);
                }

                this._map.addSource(this.id, {
                    type: 'geojson',
                    cluster: false,
                    data
                })
            }
        }

        if (!opts.layers) opts.layers = [];

        if (!opts.layers.length && this.type === 'raster') {
            opts.layers =  [{
                'id': String(this.id),
                'type': 'raster',
                'source': String(this.id)
            }]
        }

        for (const l of opts.layers) {
            this._map.addLayer(l) // before);

            // TODO: Not sure why "visibility: overlay.visible"  above isn't respected
            if (overlay.visible === false) {
                this._map.setLayoutProperty(l.id, 'visibility', 'none');
            } else if (overlay.visible === true) {
                this._map.setLayoutProperty(l.id, 'visibility', 'visible');
            }
        }

        this._layers = opts.layers;

        if (!opts.clickable) opts.clickable = [];
        for (const click of opts.clickable) {
            this._map.on('mouseenter', click.id, () => {
                if (this.draw && this.draw.getMode() !== 'static') return;
                this._map.getCanvas().style.cursor = 'pointer';
            })
            this._map.on('mouseleave', click.id, () => {
                if (this.draw && this.draw.getMode() !== 'static') return;
                this._map.getCanvas().style.cursor = '';
            })
        }

        this._clickable = opts.clickable;
    }

    async delete(): Promise<void> {
        this._destroyed = true;
        if (this._internal) return;

        if (this.id) {
            const overlay = await std(`/api/profile/overlay/${this.id}`, {
                method: 'DELETE'
            });
        }
    }

    async update(body: {
        visible?: boolean;
        opacity?: number;
    }): Promise<void> {
        if (body.opacity !== undefined) {
            for (const l of this._layers) {
                if (this.type === 'raster') {
                    this._map.setPaintProperty(this.id, 'raster-opacity', Number(this.opacity))
                }
            }
        }

        if (body.visible !== undefined) {
            for (const l of this._layers) {
                this._map.setLayoutProperty(this.id, 'visibility', this.visible ? 'visible' : 'none');
            }
        }

        await this.save();
    }

    async save(): Promise<void> {
        if (this._destroyed) throw new Error('Cannot save a destroyed layer');
        if (this._internal) return;

        let id = this.id;

        if (id) {
        } else {
            const overlay = await std(`/api/profile/overlay/${this.id}`, {
                method: 'PATCH',
                body: this
            }) as ProfileOverlay;

            this.id = overlay.id;
        }
    }
}
