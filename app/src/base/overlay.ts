import type { Observable } from 'dexie';
import { shallowReactive } from 'vue';
import { db, type DBOverlay, liveQuery } from '../database.ts';
import type { paths } from '@cloudtak/api-types';
import { server } from '../std.ts';
import BaseInterface from './interface.ts';
import Overlay from './overlay-class.ts';
import { useMapStore } from '../stores/map.ts';
import { syncOverlays, OVERLAY_LIST_CACHE_KEY } from './overlay-sync.ts';
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

const loadedOverlays = shallowReactive<Overlay[]>([]) as Overlay[];

export default class OverlayManager extends BaseInterface {
    static readonly listCacheKey = OVERLAY_LIST_CACHE_KEY;

    /** Loaded overlay instances - unordered, use stack() for map order */
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

    static appendLoaded(...overlays: Overlay[]): void {
        this.loaded.push(...overlays);
    }

    /** Loaded overlays in stack order, bottom first */
    static stack(): Overlay[] {
        return [...this.loaded].sort(OverlayManager.compareStack);
    }

    /** Create the overlay record and wait for the map to reconcile it */
    static async createLoaded(
        body: Parameters<typeof OverlayManager.generate>[0]
    ): Promise<Overlay> {
        const record = await this.generate(body);

        await useMapStore().reconcileOverlays();

        const overlay = this.loadedFrom(record.id);
        if (!overlay) throw new Error('Overlay was created but could not be loaded');

        if (overlay.mode === 'mission' && overlay._load && !await overlay._load) {
            await this.deleteLoaded(overlay).catch(() => undefined);
            throw new Error('Failed to load the Data Sync onto the map');
        }

        return overlay;
    }

    /** Persist a bottom-first order for the ordinary overlays and wait for the map to follow */
    static async reorderLoaded(orderedIds: number[]): Promise<void> {
        const ids = orderedIds.filter((id) => {
            const overlay = this.loadedFrom(id);
            return overlay && !this.isPinned(overlay);
        });

        const res = await server.PATCH('/api/profile/overlay/order', {
            body: { ids }
        });

        if (res.error) throw new Error(res.error.message);
        if (!res.data) throw new Error('Failed to reorder overlays');

        const items = res.data.items;

        await db.transaction('rw', db.overlay, async () => {
            for (const item of items) {
                await db.overlay.update(item.id, { pos: item.pos });
            }
        });

        await useMapStore().reconcileOverlays();
    }

    /**
     * Basemaps are pinned to the bottom of the stack and internal overlays
     * (e.g. "Map Features") to the top - their `pos` is a sentinel and is
     * never driven by drag order
     */
    static isPinned(overlay: { mode: string; _internal?: boolean }): boolean {
        return this.stackRank(overlay) !== 0;
    }

    /**
     * Stack comparator (bottom first) - pinned placement is decided from the
     * overlay itself so a stale or corrupted `pos` cannot misplace it
     */
    static compareStack(
        this: void,
        a: { id: number; mode: string; pos: number; _internal?: boolean },
        b: { id: number; mode: string; pos: number; _internal?: boolean }
    ): number {
        return OverlayManager.stackRank(a) - OverlayManager.stackRank(b)
            || a.pos - b.pos
            || a.id - b.id;
    }

    private static stackRank(overlay: { mode: string; _internal?: boolean }): number {
        if (overlay._internal || overlay.mode === 'internal') return 1;
        if (overlay.mode === 'basemap') return -1;
        return 0;
    }

    /**
     * Move every loaded overlay's map layers so their stacking matches
     * stack() - idempotent, so it runs after every reconcile
     */
    static applyOrder(): void {
        const stack = this.stack();

        // Moving a layer forces a full symbol re-placement even when it does
        // not change position, so only touch the map when the order differs
        const desired = stack.flatMap((overlay) => overlay.layerIds());
        const managed = new Set(desired);
        const current = useMapStore().map.getLayersOrder().filter((id) => managed.has(id));
        if (current.length === desired.length && current.every((id, i) => id === desired[i])) return;

        for (let i = stack.length - 1; i >= 0; i--) {
            stack[i].moveBefore(this.anchorAbove(stack, i + 1));
        }
    }

    /**
     * Nearest overlay at or above the given index that has a renderable
     * layer on the map - overlays with no layers (e.g. raster-dem terrain,
     * failed or still initializing) cannot be anchored against and are skipped
     */
    private static anchorAbove(stack: Overlay[], idx: number): Overlay | undefined {
        for (let i = idx; i < stack.length; i++) {
            if (stack[i].anchorLayerId()) return stack[i];
        }

        return undefined;
    }

    /** Delete the overlay record and wait for the map to drop it */
    static async deleteLoaded(idOrOverlay: string | number | Overlay): Promise<void> {
        const id = typeof idOrOverlay === 'object' ? idOrOverlay.id : this.overlayId(idOrOverlay);

        await this.delete(String(id));

        await useMapStore().reconcileOverlays();
    }

    static queryableOverlayNames(): string[] {
        return this.loaded
            .filter((overlay) => {
                return overlay.id === -1
                    || (overlay.mode === 'mission' && overlay.mode_id)
                    || overlay.actions.feature.includes('query');
            })
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

    static async get(id: string | number): Promise<DBOverlay> {
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

        return res.data as DBOverlay;
    }

    static async generate(
        body: paths['/api/profile/overlay']['post']['requestBody']['content']['application/json']
    ): Promise<DBOverlay> {
        const res = await server.POST('/api/profile/overlay', {
            body
        });

        if (res.error) throw new Error(res.error.message);
        if (!res.data) throw new Error('Failed to create overlay');

        await db.overlay.put(res.data as DBOverlay);

        return res.data as DBOverlay;
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
        await syncOverlays();
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

        return overlays.sort(OverlayManager.compareStack);
    }

    private static overlayId(id: string | number): number {
        const overlayId = Number(id);
        if (!Number.isFinite(overlayId)) throw new Error(`Invalid overlay id: ${id}`);

        return overlayId;
    }
}
