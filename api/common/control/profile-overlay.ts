import path from 'node:path';
import Err from '@openaddresses/batch-error';
import { GenericListOrder } from '@openaddresses/batch-generic';
import { sql, eq, inArray } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type Config from '../config.js';
import S3 from '../aws/s3.js';
import { ProfileOverlay } from '../schema.js';
import type { Basemap } from '../schema.js';
import TAKServerControl, { profileUid } from './takserver.js';

export type ProfileOverlayRow = InferSelectModel<typeof ProfileOverlay>;
export type BasemapRow = InferSelectModel<typeof Basemap>;

/** Either the pool or a transaction on it */
type Db = Pick<Config['pg'], 'update' | 'delete'>;

export type ProfileOverlayPatch = {
    pos?: number;
    name?: string;
    active?: boolean;
    frequency?: number | null;
    iconset?: string | null;
    type?: string;
    opacity?: number;
    visible?: boolean;
    url?: string;
    mode_id?: string;
    styles?: Array<unknown>;
};

export type ProfileOverlayInput = ProfileOverlayPatch & {
    name: string;
    mode: string;
    url: string;
    /** Mission password - only used when subscribing, never persisted */
    token?: string;
};

export type ResolvedOverlay = {
    overlay: ProfileOverlayRow;
    basemap?: BasemapRow;
};

export const DUPLICATE_CONSTRAINT = 'duplicate key value violates unique constraint';

/**
 * Profile Overlays are the per-user layer list: basemaps, hosted assets, data layers & mission subscriptions.
 *
 * Rules enforced here rather than in routes:
 * - Overlays are unique per (username, url); creating an existing url patches it in place
 * - A user has at most one `basemap` mode overlay
 * - Only `mission` overlays can be `active`, and at most one is active at a time
 * - `profile` mode urls are persisted as pathnames
 * - Mission overlays own a TAK Server subscription which is created & torn down with the overlay
 */
export default class ProfileOverlayControl {
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    static normalizeUrl(mode: string, url: string): string {
        if (mode === 'profile' && url.startsWith('http')) return new URL(url).pathname;
        return url;
    }

    /** Asset name backing a `profile` or `data` overlay - the url is `/.../<name>.pmtiles/tile` */
    static assetName(overlay: Pick<ProfileOverlayRow, 'url'>): string {
        return path.parse(overlay.url.replace(/\/tile$/, '')).name;
    }

    async from(username: string, id: number): Promise<ProfileOverlayRow> {
        const overlay = await this.config.models.ProfileOverlay.from(id);
        if (overlay.username !== username) throw new Err(403, null, 'Cannot access another\'s overlay');
        return overlay;
    }

    async byUrl(username: string, url: string): Promise<ProfileOverlayRow | undefined> {
        const list = await this.config.models.ProfileOverlay.list({
            limit: 1,
            where: sql`
                username = ${username}
                AND url = ${url}
            `,
        });

        return list.items[0];
    }

    async mission(username: string, guid: string): Promise<ProfileOverlayRow | null> {
        const list = await this.config.models.ProfileOverlay.list({
            limit: 1,
            where: sql`
                username = ${username}
                AND mode = 'mission'
                AND mode_id = ${guid}
            `,
        });

        return list.items[0] || null;
    }

    async missions(username: string): Promise<Array<ProfileOverlayRow>> {
        const list = await this.config.models.ProfileOverlay.list({
            limit: Number.MAX_SAFE_INTEGER,
            where: sql`
                username = ${username}
                AND mode = 'mission'
            `,
        });

        return list.items;
    }

    /** Mission request options (guid + stored subscription token) for TAK API calls */
    async subscription(username: string, guid: string): Promise<{ guid: string; token?: string }> {
        const overlay = await this.mission(username, guid);
        return { guid, token: overlay?.token || undefined };
    }

    private async ensureSingleBasemap(username: string, mode: string, excludeId?: number): Promise<void> {
        if (mode !== 'basemap') return;

        const count = await this.config.models.ProfileOverlay.count({
            where: sql`
                username = ${username}
                AND mode = 'basemap'
                AND id != ${excludeId ?? -1}
            `,
        });

        if (count > 0) {
            throw new Err(400, null, 'A basemap overlay already exists - only a single basemap is allowed');
        }
    }

    private async activate(username: string, mode: string, excludeId?: number): Promise<void> {
        if (mode !== 'mission') throw new Err(400, null, 'Only mission overlays can be made active');

        await this.config.pg.update(ProfileOverlay)
            .set({ active: false })
            .where(sql`
                username = ${username}
                AND active
                AND id != ${excludeId ?? -1}
            `);
    }

    private async resolveType(body: { mode: string; mode_id?: string; type?: string }): Promise<string | undefined> {
        if (body.type) return body.type;
        if ((body.mode === 'basemap' || body.mode === 'overlay') && body.mode_id) {
            return (await this.config.models.Basemap.from(parseInt(body.mode_id))).type;
        }
        return undefined;
    }

    /** Create an overlay, or patch the user's existing overlay at the same url */
    async upsert(username: string, input: ProfileOverlayInput): Promise<{ overlay: ProfileOverlayRow; created: boolean }> {
        const { token, mode, ...patch } = input;
        patch.url = ProfileOverlayControl.normalizeUrl(mode, patch.url);

        const existing = await this.byUrl(username, patch.url);

        if (existing && existing.mode !== mode) {
            throw new Err(400, null, `Overlay already exists with mode "${existing.mode}" - mode cannot be changed`);
        }

        await this.ensureSingleBasemap(username, mode, existing?.id);
        if (input.active) await this.activate(username, mode, existing?.id);

        patch.type = await this.resolveType({ mode, mode_id: patch.mode_id, type: patch.type });

        if (existing) {
            const overlay = await this.config.models.ProfileOverlay.commit(existing.id, {
                ...patch,
                opacity: patch.opacity !== undefined ? String(patch.opacity) : undefined,
            });

            return { overlay, created: false };
        }

        let subscriptionToken: string | undefined = undefined;
        if (mode === 'mission') {
            if (!patch.mode_id) throw new Err(400, null, 'Mode: Mission must have mode_id set');

            const api = await new TAKServerControl(this.config).asUser(username);
            const sub = await api.Mission.subscribe(patch.mode_id, {
                uid: profileUid(username),
            }, { token });

            subscriptionToken = sub.data.token;
        }

        const overlay = await this.config.models.ProfileOverlay.generate({
            ...patch,
            mode,
            username,
            opacity: String(patch.opacity || 1),
            token: subscriptionToken,
        });

        return { overlay, created: true };
    }

    async patch(username: string, id: number, input: ProfileOverlayPatch): Promise<ProfileOverlayRow> {
        const overlay = await this.from(username, id);

        if (input.url) input.url = ProfileOverlayControl.normalizeUrl(overlay.mode, input.url);
        if (input.active) await this.activate(username, overlay.mode, overlay.id);

        return await this.config.models.ProfileOverlay.commit(id, {
            ...input,
            opacity: input.opacity !== undefined ? String(input.opacity) : undefined,
        });
    }

    /** Delete an overlay, tearing down its mission subscription if it has one */
    async delete(username: string, id: number): Promise<ProfileOverlayRow> {
        const overlay = await this.from(username, id);

        await this.config.models.ProfileOverlay.delete(overlay.id);

        if (overlay.mode === 'mission' && overlay.mode_id) {
            try {
                const api = await new TAKServerControl(this.config).asUser(username);
                await api.Mission.unsubscribe(overlay.mode_id, {
                    uid: profileUid(username),
                }, {
                    token: overlay.token || undefined,
                });
            } catch (err) {
                // Usually the Mission has already been deleted upstream
                console.error(err);
            }
        }

        return overlay;
    }

    /**
     * Check that each overlay's backing resource still exists, deleting those that don't.
     * Basemap rows are returned alongside their overlays so callers can serialize without re-fetching
     */
    async prune(username: string, overlays: Array<ProfileOverlayRow>): Promise<{
        kept: Array<ResolvedOverlay>;
        removed: Array<ProfileOverlayRow>;
    }> {
        const api = overlays.some(o => o.mode === 'mission' && o.mode_id)
            ? await new TAKServerControl(this.config).asUser(username)
            : null;

        const results = await Promise.all(overlays.map(async (overlay): Promise<ResolvedOverlay | null> => {
            if (overlay.mode === 'profile') {
                const exists = await S3.exists(`profile/${overlay.username}/${ProfileOverlayControl.assetName(overlay)}.pmtiles`);
                return exists ? { overlay } : null;
            } else if (overlay.mode === 'data') {
                const exists = await S3.exists(`data/${overlay.mode_id}/${ProfileOverlayControl.assetName(overlay)}.pmtiles`);
                return exists ? { overlay } : null;
            } else if (overlay.mode === 'basemap' || overlay.mode === 'overlay') {
                try {
                    if (!overlay.mode_id) throw new Error('mode_id is required');
                    return { overlay, basemap: await this.config.models.Basemap.from(parseInt(overlay.mode_id)) };
                } catch (err) {
                    console.error('Could not find basemap', err);
                    return null;
                }
            } else if (overlay.mode === 'mission' && overlay.mode_id && api) {
                const subscription = await this.subscription(username, overlay.mode_id);
                return (await api.Mission.access(overlay.mode_id, subscription)) ? { overlay } : null;
            }

            return { overlay };
        }));

        const kept: Array<ResolvedOverlay> = [];
        const removed: Array<ProfileOverlayRow> = [];

        results.forEach((result, i) => {
            if (result) kept.push(result);
            else removed.push(overlays[i]);
        });

        await Promise.all(removed.map(overlay => this.config.models.ProfileOverlay.delete(overlay.id)));

        return { kept, removed };
    }

    /**
     * Ensure the given user has a Basemap overlay, creating one if necessary
     *
     * The admin configured default (`map::basemap`) is checked for existence and applied,
     * falling back to the first visible server raster Basemap. If no Basemap is
     * available this is a no-op.
     */
    async ensureDefaultBasemap(username: string): Promise<void> {
        const existing = await this.config.models.ProfileOverlay.count({
            where: sql`
                username = ${username}
                AND mode = 'basemap'
            `,
        });

        if (existing > 0) return;

        let basemap: (BasemapRow & { styles?: Array<unknown> }) | undefined = undefined;

        const configured = await this.config.models.Setting.typed('map::basemap', null);

        if (configured.value !== null) {
            try {
                const candidate = await this.config.models.Basemap.from(Number(configured.value));

                if (candidate.username || candidate.overlay || candidate.hidden) {
                    console.error(`Configured Default Basemap (map::basemap: ${configured.value}) is not a visible, non-overlay Server Basemap - falling back`);
                } else {
                    basemap = candidate;
                }
            } catch (err) {
                console.error(`Configured Default Basemap (map::basemap: ${configured.value}) could not be found - falling back`, err);
            }
        }

        if (!basemap) {
            const fallback = await this.config.models.Basemap.list({
                limit: 1,
                order: GenericListOrder.ASC,
                sort: 'name',
                where: sql`
                    username IS NULL
                    AND overlay = False
                    AND hidden = False
                    AND type = 'raster'
                `,
            });

            if (fallback.items.length) basemap = fallback.items[0];
        }

        if (!basemap) return;

        try {
            const overlay = await this.config.models.ProfileOverlay.generate({
                name: basemap.name,
                username,
                pos: -1,
                type: basemap.type,
                mode: 'basemap',
                mode_id: String(basemap.id),
                url: `/api/basemap/${basemap.id}/tiles`,
                frequency: basemap.frequency,
            });

            // Vector basemaps are unrenderable without their style layers - the
            // frontend fallback generates CoT styles bound to a source-layer that
            // won't exist in an arbitrary tileset. Persisted ProfileOverlay styles
            // are namespaced to the overlay (see Overlay.create in the frontend):
            // layer ids are prefixed with the overlay id and the source is the
            // overlay id, which is why this can't be set in the generate() above.
            const styles = (basemap.styles ?? []) as Array<Record<string, unknown>>;

            if (styles.length) {
                await this.config.models.ProfileOverlay.commit(overlay.id, {
                    styles: styles.map(layer => ({
                        ...layer,
                        id: `${overlay.id}-${layer.id}`,
                        source: String(overlay.id),
                    })),
                });
            }
        } catch (err) {
            // A concurrent login may have already provisioned the overlay - (username, url) is unique
            if (!String(err).includes(DUPLICATE_CONSTRAINT)) throw err;
        }
    }

    /** Provision the admin default terrain (`map::terrain`) as a hidden raster-dem overlay */
    async ensureDefaultTerrain(username: string): Promise<void> {
        const configured = await this.config.models.Setting.typed('map::terrain', null);
        if (configured.value === null) return;

        const existing = await this.config.models.ProfileOverlay.count({
            where: sql`
                username = ${username}
                AND type = 'raster-dem'
            `,
        });

        if (existing > 0) return;

        let terrain: BasemapRow;
        try {
            terrain = await this.config.models.Basemap.from(Number(configured.value));
        } catch (err) {
            console.error(`Configured Default Terrain (map::terrain: ${configured.value}) could not be found`, err);
            return;
        }

        if (terrain.type !== 'raster-dem' || terrain.username) {
            console.error(`Configured Default Terrain (map::terrain: ${configured.value}) is not a raster-dem Server Basemap`);
            return;
        }

        try {
            await this.config.models.ProfileOverlay.generate({
                name: terrain.name,
                username,
                type: terrain.type,
                visible: false,
                mode: 'overlay',
                mode_id: String(terrain.id),
                url: `/api/basemap/${terrain.id}/tiles`,
                frequency: terrain.frequency,
            });
        } catch (err) {
            if (!String(err).includes(DUPLICATE_CONSTRAINT)) throw err;
        }
    }

    /** Remove every overlay owned by a user - part of the user erase cascade */
    async eraseUser(username: string, db: Db = this.config.pg): Promise<void> {
        await db.delete(ProfileOverlay).where(eq(ProfileOverlay.username, username));
    }

    /** Clear iconset references ahead of iconset deletion - applies across all users */
    async detachIconsets(iconsets: Array<string>, db: Db = this.config.pg): Promise<void> {
        if (!iconsets.length) return;
        await db.update(ProfileOverlay).set({ iconset: null }).where(inArray(ProfileOverlay.iconset, iconsets));
    }
}
