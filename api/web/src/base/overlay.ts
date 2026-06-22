import { liveQuery, type Observable } from 'dexie';
import { shallowReactive } from 'vue';
import { db, type DBOverlay } from '../database.ts';
import type { paths } from '@cloudtak/api-types';
import type { ProfileOverlay, ProfileOverlayList } from '../types.ts';
import { server } from '../std.ts';
import BaseInterface from './interface.ts';
import Overlay from './overlay-class.ts';
import type {
    BaseInterface_ListOptions,
    BaseInterface_FromOptions
} from './interface.ts';

export type Overlay_DeleteOptions = {
    localOnly?: boolean;
};

export type Overlay_ListOptions = BaseInterface_ListOptions & {
    active?: boolean;
    filter?: string;
    limit?: number;
    localFirst?: boolean;
    mode?: string;
    modeId?: string | null;
    page?: number;
    visible?: boolean;
};

export type Overlay_Page = {
    total: number;
    items: DBOverlay[];
};

export type Overlay_CreateLoadedOptions = NonNullable<Parameters<typeof Overlay.create>[1]> & {
    position?: 'default' | 'prepend';
};

const loadedOverlays = shallowReactive<Overlay[]>([]) as Overlay[];

export default class OverlayManager extends BaseInterface {
    static readonly listCacheKey = 'overlay';
    static readonly loaded = loadedOverlays;

    static clearLoaded(): void {
        this.loaded.splice(0);
    }

    static loadedFrom(id: string | number): Overlay | undefined {
        const overlayId = this.overlayId(id);

        return this.loaded.find((overlay) => overlay.id === overlayId);
    }

    static loadedByName(name: string): Overlay | undefined {
        return this.loaded.find((overlay) => overlay.name === name);
    }

    static loadedByMode(mode: string, modeId: string): Overlay | undefined {
        return this.loaded.find((overlay) => overlay.mode === mode && overlay.mode_id === modeId);
    }

    private static loadedBeforeId(): string | undefined {
        if (this.loaded.length > 1 && this.loaded[1].styles.length > 0) {
            return String(this.loaded[1].styles[0].id);
        }

        return undefined;
    }

    static appendLoaded(...overlays: Overlay[]): void {
        this.loaded.push(...overlays);
    }

    static async createLoaded(
        body: Parameters<typeof Overlay.create>[0],
        opts: Overlay_CreateLoadedOptions = {}
    ): Promise<Overlay> {
        const { position = 'default', ...createOpts } = opts;
        const overlay = await Overlay.create(body, {
            ...createOpts,
            before: createOpts.before ?? this.loadedBeforeId()
        });

        if (position === 'prepend') {
            this.loaded.unshift(overlay);
        } else if (this.loaded.length > 0) {
            this.loaded.splice(1, 0, overlay);
        } else {
            this.loaded.push(overlay);
        }

        return overlay;
    }

    static async reorderLoaded(
        orderedIds: number[],
        movedId: string | number
    ): Promise<void> {
        const overlayId = this.overlayId(movedId);
        const overlay = this.loadedFrom(overlayId);
        if (!overlay) throw new Error('Could not find Overlay');

        const movedIndex = orderedIds.indexOf(overlayId);
        if (movedIndex === -1) throw new Error('Could not find Overlay in order');

        const postId = orderedIds[movedIndex + 1];
        const post = postId === undefined ? undefined : this.loadedFrom(postId);
        overlay.moveBefore(post);

        for (const current of this.loaded) {
            await current.update({
                pos: orderedIds.indexOf(current.id)
            });
        }

        this.loaded.sort((a, b) => {
            return a.pos - b.pos;
        });
    }

    static async deleteLoaded(idOrOverlay: string | number | Overlay): Promise<void> {
        const overlay = typeof idOrOverlay === 'object' ? idOrOverlay : this.loadedFrom(idOrOverlay);
        if (!overlay) return;

        const pos = this.loaded.indexOf(overlay);
        if (pos !== -1) this.loaded.splice(pos, 1);

        await overlay.delete();
    }

    static queryableOverlayNames(): string[] {
        return this.loaded
            .filter((overlay) => overlay.actions.feature.includes('query') || overlay.id === -1)
            .map((overlay) => overlay.name);
    }

    static clickableLayerMap(): Map<string, { type: string; id: string }> {
        const clickMap: Map<string, { type: string; id: string }> = new Map();

        for (const overlay of this.loaded) {
            for (const click of overlay._clickable) {
                clickMap.set(click.id, click);
            }
        }

        return clickMap;
    }

    static missionOverlays(): Overlay[] {
        return this.loaded.filter((overlay) => overlay.mode === 'mission' && overlay.mode_id);
    }

    static visibleBasemaps(): Overlay[] {
        return this.loaded.filter((overlay) => overlay.mode === 'basemap' && overlay.mode_id && overlay.visible);
    }

    static async count(opts: Omit<Overlay_ListOptions, 'limit' | 'page' | 'sync'> = {}): Promise<number> {
        return (await this.query(opts)).length;
    }

    static liveCount(opts: Omit<Overlay_ListOptions, 'limit' | 'page' | 'sync'> = {}): Observable<number> {
        return liveQuery(async () => {
            return await this.count(opts);
        });
    }

    static async list(opts: Overlay_ListOptions = {}): Promise<DBOverlay[]> {
        const cache = await this.hydrated();

        if (!cache || opts.sync) {
            const localCount = await db.overlay.count();
            if (opts.sync || !opts.localFirst || localCount === 0) {
                await this.sync();
            }
        }

        const overlays = await this.query(opts);

        if (opts.limit !== undefined) {
            return overlays.slice((opts.page ?? 0) * opts.limit, ((opts.page ?? 0) + 1) * opts.limit);
        }

        return overlays;
    }

    static async page(opts: Overlay_ListOptions = {}): Promise<Overlay_Page> {
        const [total, items] = await Promise.all([
            this.count({
                active: opts.active,
                filter: opts.filter,
                mode: opts.mode,
                modeId: opts.modeId,
                visible: opts.visible,
            }),

            this.list(opts)
        ]);

        return { total, items };
    }

    static liveList<T extends Overlay_ListOptions & { paged?: boolean } = Overlay_ListOptions>(
        opts: T = {} as T
    ): Observable<T extends { paged: true } ? Overlay_Page : DBOverlay[]> {
        return liveQuery(async () => {
            return opts.paged ? await this.page(opts) : await this.list(opts);
        }) as Observable<T extends { paged: true } ? Overlay_Page : DBOverlay[]>;
    }

    static async from(
        id: string,
        opts?: BaseInterface_FromOptions
    ): Promise<DBOverlay | undefined> {
        if (opts?.sync) {
            await this.get(id);
        }

        return await db.overlay.get(this.overlayId(id));
    }

    static liveFrom(id: string): Observable<DBOverlay | undefined> {
        return liveQuery(async () => {
            return await db.overlay.get(this.overlayId(id));
        });
    }

    static async get(id: string | number): Promise<ProfileOverlay> {
        const overlayId = this.overlayId(id);
        const res = await server.GET('/api/profile/overlay/{:overlay}', {
            params: {
                path: {
                    ':overlay': overlayId,
                }
            }
        });

        if (res.error) throw new Error(res.error.message);
        if (!res.data) throw new Error('Failed to fetch overlay');

        await db.overlay.put(res.data as DBOverlay);

        return res.data;
    }

    static async create(
        body: paths['/api/profile/overlay']['post']['requestBody']['content']['application/json']
    ): Promise<ProfileOverlay> {
        const res = await server.POST('/api/profile/overlay', {
            body
        });

        if (res.error) throw new Error(res.error.message);
        if (!res.data) throw new Error('Failed to create overlay');

        await db.overlay.put(res.data as DBOverlay);

        return res.data;
    }

    static async update(
        id: string,
        body: paths['/api/profile/overlay/{:overlay}']['patch']['requestBody']['content']['application/json']
    ): Promise<void> {
        const overlayId = this.overlayId(id);
        const res = await server.PATCH('/api/profile/overlay/{:overlay}', {
            params: {
                path: {
                    ':overlay': overlayId,
                }
            },
            body
        });

        if (res.error) throw new Error(res.error.message);
        if (!res.data) throw new Error('Failed to update overlay');

        await db.overlay.put(res.data as DBOverlay);
    }

    static async sync(): Promise<void> {
        const res = await server.GET('/api/profile/overlay', {
            params: {
                query: {
                    limit: 100,
                    page: 0,
                    order: 'asc',
                    sort: 'pos'
                }
            }
        });

        if (res.error) throw new Error(res.error.message);
        if (!res.data) throw new Error('Failed to sync overlays');

        const list = res.data as ProfileOverlayList;

        await db.transaction('rw', db.overlay, db.cache, async () => {
            await db.overlay.clear();

            if (list.items.length) {
                await db.overlay.bulkPut(list.items);
            }

            await db.cache.put({
                key: this.listCacheKey,
                updated: Date.now()
            });
        });
    }

    static async delete(id: string, opts: Overlay_DeleteOptions = {}): Promise<void> {
        const overlayId = this.overlayId(id);

        if (!opts.localOnly) {
            const { error, response } = await server.DELETE('/api/profile/overlay', {
                params: {
                    query: {
                        id: String(overlayId),
                    }
                }
            });

            if (error && response.status !== 404) throw new Error(error.message);
        }

        await db.overlay.delete(overlayId);
    }

    private static async query(opts: Omit<Overlay_ListOptions, 'limit' | 'page' | 'sync'> = {}): Promise<DBOverlay[]> {
        let overlays = await db.overlay.toArray();
        const filter = opts.filter?.trim().toLowerCase();

        if (opts.mode !== undefined) {
            overlays = overlays.filter((overlay) => overlay.mode === opts.mode);
        }

        if (opts.modeId !== undefined) {
            overlays = overlays.filter((overlay) => overlay.mode_id === opts.modeId);
        }

        if (opts.active !== undefined) {
            overlays = overlays.filter((overlay) => overlay.active === opts.active);
        }

        if (opts.visible !== undefined) {
            overlays = overlays.filter((overlay) => overlay.visible === opts.visible);
        }

        if (filter) {
            overlays = overlays.filter((overlay) => {
                return overlay.name.toLowerCase().includes(filter)
                    || String(overlay.id).includes(filter)
                    || overlay.mode.toLowerCase().includes(filter)
                    || (overlay.mode_id || '').toLowerCase().includes(filter)
                    || overlay.username.toLowerCase().includes(filter);
            });
        }

        return overlays.sort((first, second) => first.pos - second.pos || first.name.localeCompare(second.name));
    }

    private static overlayId(id: string | number): number {
        const overlayId = Number(id);
        if (!Number.isFinite(overlayId)) throw new Error(`Invalid overlay id: ${id}`);

        return overlayId;
    }
}
