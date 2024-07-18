import type { LayerSpecification } from 'maplibre-gl';
import type { ProfileOverlay, ProfileOverlay_Create } from '../../types.ts';
import { std } from '../../std.js';

/**
 * @class
 */
export default class Overlay {
    _destroyed: boolean;

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
    url: string;
    styles: any;
    token: string | null;

    static async create(body: ProfileOverlay_Create): Promise<Overlay> {
        const ov = await std('/api/profile/overlay', { method: 'POST', body });
        return new Overlay(ov);
    }

    static async load(id: number): Promise<Overlay> {
        const overlay = await std(`/api/profile/overlay/${id}`);

        return new Overlay(overlay as ProfileOverlay);
    }

    constructor(overlay: ProfileOverlay) {
        this._destroyed = false;
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

    }

    async delete(): Promise<void> {
        this._destroyed = true;

        if (this.id) {
            const overlay = await std(`/api/profile/overlay/${this.id}`, {
                method: 'DELETE'
            });
        }
    }

    async save(): Promise<ProfileOverlay> {
        if (this._destroyed) throw new Error('Cannot save a destroyed layer');

        let id = this.id;

        if (id) {
        } else {
            const overlay = await std(`/api/profile/overlay/${this.id}`, {
                method: 'PATCH',
                body: this
            }) as ProfileOverlay;

            this.id = overlay.id;

            return overlay;
        }
    }

}
