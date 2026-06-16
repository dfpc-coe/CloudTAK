import { db } from '../database.ts'
import type { Feature } from '../types.ts';
import jsonata from 'jsonata';
import { v4 as randomUUID } from 'uuid';
// eslint-disable-next-line vue/prefer-import-from-vue
import { reactive } from '@vue/reactivity';
import type { FilterSpecification, ExpressionSpecification } from 'maplibre-gl';
import PathManager from './path-manager.ts';
import type Overlay from './overlay-class.ts';

let browserModulesPromise: Promise<{
    useMapStore: typeof import('../stores/map.ts')['useMapStore'];
    OverlayManager: typeof import('./overlay.ts')['default'];
}> | null = null;

function loadBrowserModules(): NonNullable<typeof browserModulesPromise> {
    if (!browserModulesPromise) {
        browserModulesPromise = Promise.all([
            import('../stores/map.ts'),
            import('./overlay.ts')
        ]).then(([mapMod, overlayMod]) => ({
            useMapStore: mapMod.useMapStore,
            OverlayManager: overlayMod.default
        }));
    }

    return browserModulesPromise;
}

/**
 * High Level Wrapper around the Data Filters
 *
 * TODO: Once all COTs are in IndexDB, apply the filter on to a new field in the COT
 * called "filtered": [ <filterid>, ... ] so we don't have to re-evaluate the filter each time
 *
 * @property {string} id - The unique identifier for the filter
 * @property {string} external - The external ID of the filter
 * @property {string} name - The name of the filter
 * @property {string} source - The source of the filter
 * @property {boolean} internal - Whether the filter is internal
 * @property {string} query - The JSONata query string for the filter
 */
export default class Filter {
    id: string;
    external: string;
    name: string;
    source: string;
    internal: boolean;
    query: string;

    expression: jsonata.Expression;

    constructor(
        name: string,
        external: string,
        source: string,
        internal: boolean,
        query: string
    ) {
        this.id = randomUUID();

        this.name = name;
        this.external = external;
        this.source = source;
        this.internal = internal;
        this.query = query;

        this.expression = jsonata(this.query);
    }

    async test(feature: Feature): Promise<boolean> {
        return await this.expression.evaluate(feature);
    }

    static async list(): Promise<Filter[]> {
        const filters = await db.filter.toArray();

        return filters.map(f => {
            const filter = new Filter(
                f.name,
                f.external,
                f.source,
                f.internal,
                f.query
            );

            filter.id = f.id;

            return filter;
        });
    }

    static async from(
        id: string
    ): Promise<Filter | null> {
        const exists = await db.filter
            .get(id)

        if (!exists) return null;

        const filter = new Filter(
            exists.name,
            exists.external,
            exists.source,
            exists.internal,
            exists.query
        );

        filter.id = exists.id;

        return filter;
    }

    async update(
        body: {
            name?: string;
            external?: string;
            source?: string;
            internal?: boolean;
            query?: string;
        }
    ): Promise<void> {
        if (body.name !== undefined) this.name = body.name;
        if (body.external !== undefined) this.external = body.external;
        if (body.source !== undefined) this.source = body.source;
        if (body.internal !== undefined) this.internal = body.internal;
        if (body.query !== undefined) this.query = body.query;

        await db.filter.update(this.id, {
            name: this.name,
            external: this.external,
            source: this.source,
            internal: this.internal,
            query: this.query,
        });
    }

    static async create(
        name: string,
        external: string,
        source: string,
        internal: boolean,
        query: string
    ): Promise<Filter> {
        const filter = new Filter(
            name,
            external,
            source,
            internal,
            query
        );

        await db.filter.add({
            id: filter.id,
            name: filter.name,
            external: filter.external,
            source: filter.source,
            internal: filter.internal,
            query: filter.query,
        });

        return filter;
    }

    async delete(): Promise<void> {
        await Filter.delete({ id: this.id });
    }

    static async delete(id: {
        id?: string;
        external?: string;
    }): Promise<void> {
        if (!id.id && !id.external) {
            throw new Error('Either id or external must be provided for deletion.');
        } else if (id.id) {
            await db.filter
                .where('id')
                .equals(id.id)
                .delete();
        } else if (id.external) {
            await db.filter
                .where('external')
                .equals(id.external)
                .delete();
        }
    }
}

/**
 * Source id used for the internal "Map Features" GeoJSON overlay that holds
 * all non-mission CoTs. Mirrors the `Overlay.internal({ id: -1 })` registration.
 */
export const GENERAL_SOURCE_ID = '-1';

const VISIBILITY_KEY = 'feature-visibility';

type VisibilityState = {
    paths: Record<string, string[]>;
    features: string[];
};

const visibilityState = reactive<VisibilityState>({
    paths: {},
    features: []
});

export class FeatureVisibility {
    static async load(): Promise<void> {
        try {
            const row = await db.kv.get(VISIBILITY_KEY);
            if (!row || !row.value) return;

            const parsed = JSON.parse(row.value) as Partial<VisibilityState>;

            visibilityState.paths = parsed.paths && typeof parsed.paths === 'object' ? parsed.paths : {};
            visibilityState.features = Array.isArray(parsed.features) ? parsed.features : [];
        } catch (err) {
            console.error('Failed to load feature visibility state:', err);
        }
    }

    private static async persist(): Promise<void> {
        try {
            await db.kv.put({
                key: VISIBILITY_KEY,
                value: JSON.stringify({
                    paths: visibilityState.paths,
                    features: visibilityState.features
                })
            });
        } catch (err) {
            console.error('Failed to persist feature visibility state:', err);
        }
    }

    static isFeatureHidden(id: string): boolean {
        return visibilityState.features.includes(id);
    }

    static isPathHidden(sourceId: string | number, path: string): boolean {
        const list = visibilityState.paths[String(sourceId)];
        if (!list) return false;
        return list.includes(PathManager.normalize(path));
    }

    static setFeatureHidden(id: string, hidden: boolean): void {
        const idx = visibilityState.features.indexOf(id);

        if (hidden && idx === -1) {
            visibilityState.features.push(id);
        } else if (!hidden && idx !== -1) {
            visibilityState.features.splice(idx, 1);
        } else {
            return;
        }

        this.persist();
        this.apply();
    }

    static toggleFeature(id: string): void {
        this.setFeatureHidden(id, !this.isFeatureHidden(id));
    }

    static setFeaturesHidden(ids: string[], hidden: boolean): void {
        let changed = false;

        for (const id of ids) {
            const idx = visibilityState.features.indexOf(id);
            if (hidden && idx === -1) {
                visibilityState.features.push(id);
                changed = true;
            } else if (!hidden && idx !== -1) {
                visibilityState.features.splice(idx, 1);
                changed = true;
            }
        }

        if (!changed) return;

        this.persist();
        this.apply();
    }

    static areFeaturesHidden(ids: string[]): boolean {
        return ids.length > 0 && ids.every((id) => visibilityState.features.includes(id));
    }

    static setPathHidden(sourceId: string | number, path: string, hidden: boolean): void {
        const key = String(sourceId);
        const normalized = PathManager.normalize(path);
        const list = visibilityState.paths[key] || [];
        const idx = list.indexOf(normalized);

        if (hidden && idx === -1) {
            list.push(normalized);
        } else if (!hidden && idx !== -1) {
            list.splice(idx, 1);
        } else {
            return;
        }

        if (list.length) {
            visibilityState.paths[key] = list;
        } else {
            delete visibilityState.paths[key];
        }

        this.persist();
        this.apply();
    }

    static togglePath(sourceId: string | number, path: string): void {
        this.setPathHidden(sourceId, path, !this.isPathHidden(sourceId, path));
    }

    private static buildPredicate(sourceId: string): ExpressionSpecification | null {
        const clauses: ExpressionSpecification[] = [];

        const paths = visibilityState.paths[sourceId] || [];
        for (const raw of paths) {
            const path = PathManager.normalize(raw);
            if (path === '/') continue;

            clauses.push(['==', ['get', 'path'], path]);
            clauses.push([
                '==',
                ['slice', ['coalesce', ['get', 'path'], '/'], 0, path.length + 1],
                `${path}/`
            ]);
        }

        if (visibilityState.features.length) {
            clauses.push(['in', ['get', 'id'], ['literal', [...visibilityState.features]]]);
        }

        if (!clauses.length) return null;

        return ['!', ['any', ...clauses]];
    }

    static async applyToOverlay(overlay: Overlay): Promise<void> {
        if (overlay.type !== 'geojson') return;

        const { useMapStore } = await loadBrowserModules();

        const mapStore = useMapStore();
        if (!mapStore._map) return;
        const map = mapStore.map;

        const predicate = this.buildPredicate(String(overlay.id));

        for (const style of overlay.styles) {
            if (!map.getLayer(style.id)) continue;

            const base = (style as { filter?: FilterSpecification }).filter;

            let composed: FilterSpecification | undefined;
            if (predicate && base) {
                composed = ['all', base, predicate] as unknown as FilterSpecification;
            } else if (predicate) {
                composed = predicate as unknown as FilterSpecification;
            } else {
                composed = base;
            }

            try {
                map.setFilter(style.id, composed);
            } catch (err) {
                console.error(`Failed to apply visibility filter to layer ${style.id}:`, err);
            }
        }
    }

    static async apply(): Promise<void> {
        try {
            const { useMapStore, OverlayManager } = await loadBrowserModules();

            const mapStore = useMapStore();
            if (!mapStore._map) return;

            await Promise.all(OverlayManager.listLoaded().map((overlay) => this.applyToOverlay(overlay)));
        } catch (err) {
            console.error('Failed to apply visibility filters:', err);
        }
    }
}
