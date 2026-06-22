import { db } from '../../database.ts'
// eslint-disable-next-line vue/prefer-import-from-vue
import { reactive } from '@vue/reactivity';
import type { FilterSpecification, ExpressionSpecification } from 'maplibre-gl';
import PathManager from '../../base/path-manager.ts';
import type Overlay from '../../base/overlay-class.ts';

let browserModulesPromise: Promise<{
    useMapStore: typeof import('../map.ts')['useMapStore'];
    OverlayManager: typeof import('../../base/overlay.ts')['default'];
}> | null = null;

function loadBrowserModules(): NonNullable<typeof browserModulesPromise> {
    if (!browserModulesPromise) {
        browserModulesPromise = Promise.all([
            import('../map.ts'),
            import('../../base/overlay.ts')
        ]).then(([mapMod, overlayMod]) => ({
            useMapStore: mapMod.useMapStore,
            OverlayManager: overlayMod.default
        }));
    }

    return browserModulesPromise;
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

            await Promise.all(OverlayManager.loaded.map((overlay) => this.applyToOverlay(overlay)));
        } catch (err) {
            console.error('Failed to apply visibility filters:', err);
        }
    }
}
