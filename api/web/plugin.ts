import type { App } from 'vue';
import type { Component } from 'vue';
import { markRaw, defineAsyncComponent } from 'vue';
import type { Router, RouteRecordRaw } from 'vue-router';
import type { Pinia } from 'pinia';
import { useMapStore } from './src/stores/map.ts';
import { useFloatStore, type PaneConfig } from './src/stores/float.ts';
import type { MenuItemConfig } from './src/stores/modules/menu.ts';
import { db, type DBFeature } from './src/base/database.ts';
import { liveQuery } from 'dexie';
import { from, type Observable } from 'rxjs';
import mapgl from 'maplibre-gl';

const FloatingGeneric = defineAsyncComponent(() => import('./src/components/CloudTAK/util/FloatingGeneric.vue'));

export type { MenuItemConfig };
export type { DBFeature };

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
             * Stream features from the local database
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
            }) => {
                return floatStore.add({
                    uid: opts.uid,
                    name: opts.name,
                    component: FloatingGeneric,
                    config: {
                        _component: markRaw(opts.component),
                        _actions: opts.actions ? markRaw(opts.actions) : undefined,
                        _props: opts.props ? markRaw(opts.props) : {},
                    },
                    height: opts.height,
                    width: opts.width,
                    x: opts.x,
                    y: opts.y,
                });
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
};
