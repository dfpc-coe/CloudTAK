import type { App } from 'vue';
import type { Component } from 'vue';
import { markRaw, toRaw, defineAsyncComponent } from 'vue';
import type { Router, RouteRecordRaw } from 'vue-router';
import type { Pinia } from 'pinia';
import { useMapStore } from './src/stores/map.ts';
import { useFloatStore } from './src/stores/float.ts';
import type { MenuItemConfig } from './src/stores/modules/menu.ts';
import type { BottomBarItemConfig } from './src/stores/modules/bottombar.ts';
import { db, type DBFeature, type DBFeatureHistory, FeatureHistorySource } from './src/database.ts';
import FeatureHistory, { type FeatureHistory_ListOptions } from './src/base/feature-history.ts';
import ProfileConfig from './src/base/profile.ts';
import type { Profile } from './src/types.ts';
import type { HistoryPopupRenderer } from './src/stores/modules/history.ts';
import { liveQuery } from 'dexie';
import { from, type Observable } from 'rxjs';
import * as mapgl from 'maplibre-gl';
import { std, stdurl } from './src/std.ts';

const FloatingGeneric = defineAsyncComponent(() => import('./src/components/CloudTAK/util/FloatingGeneric.vue'));

export type { MenuItemConfig };
export type { BottomBarItemConfig };
export type { DBFeature };
export type { DBFeatureHistory };
export type { FeatureHistory_ListOptions };
export type { HistoryPopupRenderer };
export type { Profile };
export { FeatureHistorySource };

/** Time window for CoT history queries - TAK Server answers at most 24 hours */
export type HistoryWindow = {
    start?: string;
    end?: string;
    secago?: number;
};

export type HistoryAllOptions = HistoryWindow & {
    /** Restrict to events within [minLon, minLat, maxLon, maxLat] */
    bbox?: [number, number, number, number];
    /** TAK Server default (true) only returns a-f, a-n, a-u, a-h & b-m-r events plus chat; false returns every stored event */
    filtered?: boolean;
};

/**
 * Configuration stored with a floating pane created by the plugin API
 */
export type FloatingPaneConfig = Record<string, unknown> & {
    _component: Component;
    _actions?: Component;
    _props: Record<string, unknown>;
}

/**
 * Public representation of a floating pane managed through the plugin API
 */
export interface FloatingPane {
    uid: string;
    name?: string;
    component: Component;
    config: FloatingPaneConfig;
    height: number;
    width: number;
    x: number;
    y: number;
}

export interface PluginInstance {
    /**
     * Called after `install` if the server has the plugin enabled by default
     * or if the user has opted in to the plugin functionality
     */
    enable(): Promise<void>;

    /**
     * Called if the user disables the plugin, the plugin must
     * remove all functionality from the user facing app
     */
    disable(): Promise<void>;
}

export interface PluginStatic {
    /**
     * Hook called on init, note the plugin should not make itself
     * usable unless enable() is called.
     */
    install(
        app: App,
        api: PluginAPI
    ): PluginInstance | Promise<PluginInstance>;
}

/**
 * The Main Plugin API for managing CloudTAK UI functions
 */
export class PluginAPI {
    /**
     * The Vue App instance
     */
    app: App;
    /**
     * The Vue Router instance
     */
    router: Router;
    /**
     * The Pinia Store instance
     */
    pinia: Pinia;

    /**
     * @param app The Vue App instance
     * @param router The Vue Router instance
     * @param pinia The Pinia Store instance
     */
    constructor(
        app: App,
        router: Router,
        pinia: Pinia
    ) {
        this.app = app;
        this.router = router;
        this.pinia = pinia;
    }

    /**
     * Manage the Main Menu
     */
    get menu() {
        const mapStore = useMapStore(this.pinia);
        return {
            /**
             * Add a new item to the main menu
             * @param item The menu item configuration
             */
            add: (item: MenuItemConfig) => {
                if (!item.routeExternal && !this.router.hasRoute(item.route)) {
                    console.warn(`Failed to add menu item, route '${item.route}' not found`);
                    return;
                }

                try {
                    mapStore.menu.addMenuItem(item);
                } catch (err) {
                    console.warn('Failed to add menu item, map not loaded?', err);
                }
            },
            /**
             * Remove an item from the main menu
             * @param key The key of the menu item to remove
             */
            remove: (key: string) => {
                try {
                    mapStore.menu.removeMenuItem(key);
                } catch (err) {
                    // Ignore error if menu is not loaded
                }
            }
        }
    }

    /**
     * Manage Application Routes
     */
    get routes() {
        return {
            /**
             * Add a new route to the application
             * @param route The route configuration
             * @param parentName The name of the parent route to add this route to (optional)
             */
            add: (route: RouteRecordRaw, parentName?: string) => {
                if (route.name && this.router.hasRoute(route.name)) {
                    return;
                }

                if (parentName) {
                    this.router.addRoute(parentName, route);
                } else {
                    this.router.addRoute(route);
                }
            }
        }
    }

    /**
     * Map Accessors
     */
    get map(): mapgl.Map {
        const mapStore = useMapStore(this.pinia);
        return mapStore.map;
    }

    /**
     * Manage Features
     */
    get feature() {
        return {
            /**
             * List features from the local database
             * @param opts Filter options
             */
            list: (opts: {
                filter?: (feature: DBFeature) => boolean;
            } = {}): Promise<DBFeature[]> => {
                if (opts.filter) {
                    return db.feature.filter(opts.filter).toArray();
                }
                return db.feature.toArray();
            },

            /**
             * Stream one feature by its CoT UID, re-emitting only when that
             * row changes. Prefer this over `stream` with a filter whenever a
             * single feature is wanted - a filter scans the whole table on
             * every write anywhere in it.
             * @param uid The CoT UID
             */
            streamOne: (uid: string): Observable<DBFeature | undefined> => {
                return from(liveQuery(() => db.feature.get(uid))) as Observable<DBFeature | undefined>;
            },

            /**
             * Stream features from the local database. The filter runs over
             * the entire table and re-runs on every feature write, so keep
             * one stream per list rather than one per item.
             * @param opts Filter options
             */
            stream: (opts: {
                filter?: (feature: DBFeature) => boolean;
            } = {}): Observable<DBFeature[]> => {
                return from(liveQuery(() => {
                    if (opts.filter) {
                        return db.feature.filter(opts.filter).toArray();
                    }
                    return db.feature.toArray();
                })) as Observable<DBFeature[]>;
            }
        }
    }

    /**
     * Manage CoT Marti Queries
     */
    get cot() {
        return {
            /**
             * Fetch the historic CoT points for a given UID from the TAK Server.
             *
             * Each point is returned as its own Feature retaining its temporal
             * attributes so callers can build time-series visualizations.
             *
             * @param uid  The CoT UID to fetch history for
             * @param opts Optional time window constraints
             */
            history: async (uid: string, opts: HistoryWindow = {}): Promise<DBFeature[]> => {
                const url = stdurl(`/api/marti/cot/${encodeURIComponent(uid)}/all`);
                url.searchParams.set('track', 'false');
                if (opts.start) url.searchParams.set('start', opts.start);
                if (opts.end) url.searchParams.set('end', opts.end);
                if (opts.secago !== undefined) url.searchParams.set('secago', String(opts.secago));

                const body = await std(url) as { type: string; features: DBFeature[] };
                return body.features || [];
            },

            /**
             * Fetch every historic CoT point visible to the user within a time
             * window (at most 24 hours) from the TAK Server, optionally
             * restricted to a bounding box.
             *
             * Each point is returned as its own Feature retaining its temporal
             * attributes. Nothing is stored - see `breadcrumb.history.loadAll`
             * to record and render the result.
             *
             * @param opts Time window & spatial constraints
             */
            historyAll: async (opts: HistoryAllOptions = {}): Promise<DBFeature[]> => {
                const url = stdurl('/api/marti/cot');
                if (opts.start) url.searchParams.set('start', opts.start);
                if (opts.end) url.searchParams.set('end', opts.end);
                if (opts.secago !== undefined) url.searchParams.set('secago', String(opts.secago));
                if (opts.bbox) url.searchParams.set('bbox', opts.bbox.join(','));
                if (opts.filtered !== undefined) url.searchParams.set('filtered', String(opts.filtered));

                const body = await std(url) as { type: string; features: DBFeature[] };
                return body.features || [];
            }
        }
    }

    /**
     * Manage Breadcrumb Trails
     */
    get breadcrumb() {
        const mapStore = useMapStore(this.pinia);
        return {
            /**
             * Manage live breadcrumb trail recording
             */
            live: {
                /**
                 * Enable live breadcrumb trail recording for a given CoT UID
                 * @param uid The CoT UID to start recording
                 */
                add: (uid: string): Promise<void> => {
                    return mapStore.worker.db.breadcrumb.set(uid, true);
                },
                /**
                 * Disable live breadcrumb trail recording for a given CoT UID
                 * @param uid The CoT UID to stop recording
                 */
                remove: (uid: string): Promise<void> => {
                    return mapStore.worker.db.breadcrumb.set(uid, false);
                },
                /**
                 * Returns all CoT UIDs that currently have live breadcrumb recording enabled
                 */
                list: (): Promise<string[]> => {
                    return mapStore.worker.db.breadcrumb.listEnabled();
                },
                /**
                 * Stream the CoT UIDs with live recording enabled, re-emitting
                 * whenever recording is enabled or disabled for any UID
                 */
                stream: (): Observable<string[]> => {
                    return from(liveQuery(async () => {
                        const rows = await db.breadcrumb.filter((row) => row.live === true).toArray();
                        return rows.map((row) => row.uid);
                    })) as Observable<string[]>;
                },
            },
            /**
             * Manage the local history of discrete, timestamped CoT points that
             * breadcrumb trails are drawn from. Every point keeps the properties
             * the CoT carried at that moment; CloudTAK renders the points and
             * the trail through them, with hover & click surfacing each point.
             */
            history: {
                /**
                 * Fetch a CoT's history from the TAK Server and record it locally
                 * @param uid  The CoT UID to load history for
                 * @param opts Time window (at most 24 hours)
                 * @returns the recorded points, oldest first
                 */
                load: async (uid: string, opts: HistoryWindow = {}): Promise<DBFeatureHistory[]> => {
                    const features = await this.cot.history(uid, opts);
                    await mapStore.worker.db.breadcrumb.ingest(features);

                    const end = opts.end ? new Date(opts.end).getTime() : Date.now();
                    const start = opts.start
                        ? new Date(opts.start).getTime()
                        : (opts.secago !== undefined ? end - opts.secago * 1000 : undefined);

                    return FeatureHistory.list({ uid, start, end: opts.end ? end : undefined });
                },
                /**
                 * Fetch every CoT's history within a time window from the TAK
                 * Server and record it locally
                 * @param opts Time window, spatial constraints and an optional
                 *             filter applied before anything is recorded
                 * @returns the number of points recorded
                 */
                loadAll: async (opts: HistoryAllOptions & {
                    filter?: (feature: DBFeature) => boolean;
                } = {}): Promise<number> => {
                    let features = await this.cot.historyAll(opts);
                    if (opts.filter) features = features.filter(opts.filter);
                    return mapStore.worker.db.breadcrumb.ingest(features);
                },
                /**
                 * Record CoT reports the plugin already holds (for example a
                 * live update it wants on the trail) as history points. Each
                 * report needs an id and a `time`/`start`; a report recorded
                 * twice overwrites itself
                 * @param features The reports to record
                 * @returns the number of points recorded
                 */
                record: (features: DBFeature[], opts: { source?: FeatureHistorySource } = {}): Promise<number> => {
                    // Vue proxies cannot cross the worker boundary (structured clone throws)
                    const plain = features.map((feature) => toRaw(feature));
                    return mapStore.worker.db.breadcrumb.ingest(plain, { source: opts.source || FeatureHistorySource.Live });
                },
                /**
                 * List recorded history points, oldest first
                 * @param opts Optional UID and time bounds
                 */
                list: (opts: FeatureHistory_ListOptions = {}): Promise<DBFeatureHistory[]> => {
                    return FeatureHistory.list(opts);
                },
                /**
                 * Stream recorded history points, re-emitting as points are
                 * recorded or cleared
                 * @param opts Optional UID and time bounds
                 */
                stream: (opts: FeatureHistory_ListOptions = {}): Observable<DBFeatureHistory[]> => {
                    return from(FeatureHistory.stream(opts)) as Observable<DBFeatureHistory[]>;
                },
                /**
                 * Remove recorded history. With a UID the trail is removed and
                 * its live recording disabled; without one every trail is cleared
                 */
                clear: async (uid?: string): Promise<void> => {
                    if (uid) {
                        await mapStore.worker.db.breadcrumb.remove(uid);
                        return;
                    }

                    await mapStore.worker.db.breadcrumb.clearAll();
                },
                /**
                 * Popup shown while hovering a history point on the map
                 */
                popup: {
                    /**
                     * Register a renderer for the hover popup. Renderers run in
                     * registration order and the first to return content wins;
                     * return nothing to fall through to CloudTAK's default body
                     * @param key      Unique key for the renderer
                     * @param renderer Returns an HTML string or element for a point
                     */
                    set: (key: string, renderer: HistoryPopupRenderer): void => {
                        mapStore.history.setPopup(key, renderer);
                    },
                    /**
                     * Remove a previously registered renderer
                     * @param key The renderer key
                     */
                    remove: (key: string): void => {
                        try {
                            mapStore.history.removePopup(key);
                        } catch {
                            // Ignore error if the map is not loaded
                        }
                    },
                },
            },
        }
    }

    /**
     * Manage Floating Panes on top of the Map View
     */
    get float() {
        const floatStore = useFloatStore(this.pinia);
        return {
            /**
             * Add a new floating pane
             * @param opts Floating pane configuration
             */
            add: (opts: {
                uid: string,
                name?: string,
                component: Component,
                actions?: Component,
                props?: Record<string, unknown>,
                height?: number,
                width?: number,
                x?: number,
                y?: number,
            }): FloatingPane => {
                const config: FloatingPaneConfig = {
                    _component: markRaw(opts.component),
                    _actions: opts.actions ? markRaw(opts.actions) : undefined,
                    _props: opts.props ? markRaw(opts.props) : {},
                };

                const pane = floatStore.add({
                    uid: opts.uid,
                    name: opts.name,
                    component: FloatingGeneric,
                    config,
                    height: opts.height,
                    width: opts.width,
                    x: opts.x,
                    y: opts.y,
                });

                return {
                    uid: pane.uid,
                    name: pane.name,
                    component: pane.component,
                    config,
                    height: pane.height,
                    width: pane.width,
                    x: pane.x,
                    y: pane.y,
                };
            },
            /**
             * Remove a floating pane
             * @param uid The unique identifier of the pane to remove
             */
            remove: (uid: string) => {
                floatStore.delete(uid);
            },
            /**
             * Check if a floating pane exists
             * @param uid The unique identifier to check
             */
            has: (uid: string): boolean => {
                return floatStore.panes.has(uid);
            }
        }
    }

    /**
     * Read the signed-in user's profile settings, such as the display units
     * chosen under Settings. Settings are read-only to plugins.
     */
    get profile() {
        return {
            /**
             * Current value of a profile setting
             * @param key The profile key, e.g. `display_radiation_dose`
             * @returns the value, or undefined until the profile has synced
             */
            get: async <K extends keyof Profile>(key: K): Promise<Profile[K] | undefined> => {
                const entry = await ProfileConfig.get(key);
                return entry ? entry.value : undefined;
            },
            /**
             * Stream a profile setting, emitting its current value and every
             * later change so views can follow the user's choice live
             * @param key The profile key
             */
            stream: <K extends keyof Profile>(key: K): Observable<Profile[K] | undefined> => {
                return from(liveQuery(async () => {
                    const entry = await db.profile.get(key);
                    return entry ? entry.value as Profile[K] : undefined;
                })) as Observable<Profile[K] | undefined>;
            },
            /**
             * Every profile setting currently synced
             */
            list: async (): Promise<Partial<Profile>> => {
                const profile: Record<string, unknown> = {};
                for (const entry of await db.profile.toArray()) {
                    profile[entry.key] = entry.value;
                }
                return profile as Partial<Profile>;
            }
        }
    }

    /**
     * Manage the floating plugin pane at the bottom centre of the map.
     * The pane is only rendered while at least one item is registered.
     */
    get bottomBar() {
        const mapStore = useMapStore(this.pinia);
        return {
            /**
             * Add a component to the floating plugin pane
             * @param item The bottom bar item configuration
             */
            add: (item: BottomBarItemConfig) => {
                try {
                    mapStore.bottomBar.addItem(item);
                } catch (err) {
                    console.warn('Failed to add bottom bar item, map not loaded?', err);
                }
            },
            /**
             * Remove a previously registered plugin pane component by key
             * @param key The key of the item to remove
             */
            remove: (key: string) => {
                try {
                    mapStore.bottomBar.removeItem(key);
                } catch (err) {
                    // Ignore error if bottomBar is not loaded
                }
            }
        }
    }
}
