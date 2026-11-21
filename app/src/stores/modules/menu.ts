import { ref, computed, toRaw, markRaw } from 'vue';
import type { Component, Ref, ComputedRef } from "vue";
import {
    IconBug,
    IconMap,
    IconFiles,
    IconUsers,
    IconVideo,
    IconDeviceTv,
    IconLayoutKanban,
    IconPhoto,
    IconRoute,
    IconMapPin,
    IconMessage,
    IconNetwork,
    IconPackages,
    IconSettings,
    IconCloudPin,
    IconServerCog,
    IconBoxMultiple,
    IconAffiliate,
    IconHistory,
} from '@tabler/icons-vue';
import ProfileConfig from '../../base/profile.ts';
import Chatroom from '../../base/chatroom.ts';
import Config from '../../base/config.ts';
import TAKNZ_NAV_ICONS from '../../base/taknz-nav-icons.ts';
import type { Profile } from '../../types.ts';
import { isNativePlatform } from '../../utils/capacitor.ts';

export type MenuItemConfig = {
    key: string;
    label: string;
    route: string;
    routeExternal?: boolean;
    tooltip: string;
    description?: string;
    icon: Component;
    badge?: string;
    visibility?: string;
    requiresSystemAdmin?: boolean;
    requiresAgencyAdmin?: boolean;
    requiresMedia?: boolean;
};

/**
 * Manage Pluggable Menu
 */
export default class MenuManager {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mapStore: any;
    filter: Ref<string>;
    preferredLayout: Ref<'list' | 'tiles'>;
    onlineContactsCount: Ref<number>;
    unreadChatsCount: Ref<number>;
    isSystemAdmin: Ref<boolean>;
    isAgencyAdmin: Ref<boolean>;
    mediaEnabled: Ref<boolean>;
    pluginMenuItems: Ref<MenuItemConfig[]>;
    preferenceOrder: Ref<Profile['menu_order']>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(mapStore: any) {
        this.mapStore = mapStore;
        this.filter = ref('');
        this.onlineContactsCount = ref(0);
        this.unreadChatsCount = ref(0);
        this.isSystemAdmin = ref(false);
        this.isAgencyAdmin = ref(false);
        this.mediaEnabled = ref(false);
        this.pluginMenuItems = ref([]);
        this.preferenceOrder = ref([]);

        const storedLayoutPref = typeof window !== 'undefined' ? localStorage.getItem('cloudtak-menu-layout') : null;
        this.preferredLayout = ref<'list' | 'tiles'>(storedLayoutPref === 'tiles' ? 'tiles' : 'list');
    }

    async init() {
        const isSystemAdmin = await ProfileConfig.get('system_admin');
        this.isSystemAdmin.value = isSystemAdmin?.value ?? false;

        const isAgencyAdmin = await ProfileConfig.get('agency_admin');
        this.isAgencyAdmin.value = (isAgencyAdmin?.value && isAgencyAdmin.value.length > 0) || false;

        try {
            const mediaConfig = await Config.list(['media::url']);
            this.mediaEnabled.value = !!(mediaConfig['media::url'] as string | undefined)?.trim();
        } catch {
            this.mediaEnabled.value = false;
        }

        try {
            const menuOrder = await ProfileConfig.get('menu_order');
            if (menuOrder && menuOrder.value) {
                this.preferenceOrder.value = menuOrder.value;
            }
        } catch (e) {
            console.error('Failed to load menu order', e);
        }

        // Online contacts live in the worker's memory, not IndexedDB. Later
        // changes arrive as Contact_Online_Change messages handled in mapStore.
        try {
            this.onlineContactsCount.value = await this.mapStore.worker.db.onlineContactCount();
        } catch (e) {
            console.error('Failed to load online contact count', e);
        }

        Chatroom.liveUnreadCount().subscribe((count) => {
            this.unreadChatsCount.value = count;
        });
    }

    get baseMenuItems(): MenuItemConfig[] {
        return [
            {
                key: 'features',
                label: 'Features',
                route: '/menu/features',
                tooltip: 'Features',
                description: 'Saved features, events, and devices',
                icon: IconMapPin,
            },
            {
                key: 'overlays',
                label: 'Overlays',
                route: '/menu/overlays',
                tooltip: 'Overlays',
                description: 'Toggle and configure data overlays',
                icon: IconBoxMultiple,
            },
            {
                key: 'contacts',
                label: 'Contacts',
                route: '/menu/contacts',
                tooltip: 'Contacts',
                description: 'Manage and search for contacts',
                icon: IconUsers,
            },
            {
                key: 'basemaps',
                label: 'BaseMaps',
                route: '/menu/basemaps',
                tooltip: 'Basemaps',
                description: 'Switch between available basemaps',
                icon: IconMap,
            },
            {
                key: 'missions',
                label: 'Data Sync',
                route: '/menu/missions',
                tooltip: 'Data Sync',
                description: 'Real-Time Datasets',
                icon: IconCloudPin,
            },
            {
                key: 'packages',
                label: 'Data Package',
                route: '/menu/packages',
                tooltip: 'Data Packages',
                description: 'Create and share Data Packages',
                icon: IconPackages,
            },
            {
                key: 'channels',
                label: 'Channels',
                route: '/menu/channels',
                tooltip: 'Channels',
                description: 'Join and manage Data Channels',
                icon: IconAffiliate,
            },
            {
                key: 'videos',
                label: 'Videos',
                route: '/menu/videos',
                tooltip: 'Videos',
                description: 'Access live and recorded video feeds',
                icon: IconVideo,
                requiresMedia: true,
            },
            {
                // Upstream surfaces the Video Wall from the Application Switcher in
                // MainMenuContents.vue. This fork drops that switcher, which removed
                // the only direct link to /video, so the wall is a normal menu entry
                // here instead - which also gives it the reorder and visibility
                // handling the switcher never had. Opens in its own tab, like Admin.
                key: 'videowall',
                label: 'Video Wall',
                route: '/video',
                routeExternal: true,
                tooltip: 'Video Wall',
                description: 'Grid of video streams pushed from the map',
                icon: IconDeviceTv,
                requiresMedia: true,
            },
            {
                // Event Board lost its menu link the same way the Video Wall did -
                // it was the switcher's other entry. Ungated, matching upstream:
                // it is neither media- nor admin-scoped.
                key: 'eventboard',
                label: 'Event Board',
                route: '/board',
                routeExternal: true,
                tooltip: 'Event Board',
                description: 'Track and triage Core Events on a board',
                icon: IconLayoutKanban,
            },
            {
                key: 'chats',
                label: 'Chats',
                route: '/menu/chats',
                tooltip: 'Chats',
                description: 'Open chat threads and history',
                icon: IconMessage,
            },
            {
                key: 'routes',
                label: 'Routes',
                route: '/menu/routes',
                tooltip: 'Routes',
                description: 'Plan and manage route overlays',
                icon: IconRoute,
            },
            {
                key: 'files',
                label: 'Files',
                route: '/menu/files',
                tooltip: 'Files',
                description: 'Browse your uploaded and offline files',
                icon: IconFiles,
            },
            {
                key: 'iconsets',
                label: 'Iconsets',
                route: '/menu/iconsets',
                tooltip: 'Iconsets',
                description: 'Customize Icons',
                icon: IconPhoto,
            },
            {
                key: 'connections',
                label: 'Connections',
                route: '/menu/connections',
                tooltip: 'Connections (Admin)',
                description: 'Manage Integrations',
                icon: IconNetwork,
                badge: 'A',
                requiresAgencyAdmin: true,
            },
            {
                key: 'debugger',
                label: 'COT Debugger',
                route: '/menu/debugger',
                tooltip: 'Debugger (Admin)',
                description: 'Inspect and debug COT traffic',
                icon: IconBug,
                badge: 'A',
                requiresSystemAdmin: true,
            },
            {
                key: 'server',
                label: 'Admin',
                route: '/admin',
                routeExternal: true,
                tooltip: 'Admin',
                description: 'Manage CloudTAK administration and server settings.',
                icon: IconServerCog,
                badge: 'A',
                requiresSystemAdmin: true,
            },
            {
                key: 'history',
                label: 'History',
                route: '/menu/history',
                tooltip: 'History',
                description: 'Breadcrumb trails and track history',
                icon: IconHistory,
            },
            {
                key: 'settings',
                label: 'Settings',
                route: '/menu/settings',
                tooltip: 'Display Settings',
                description: 'Adjust personal display preferences.',
                icon: IconSettings,
            },
        ].map((item) => {
            // TAK.NZ swaps in ATAK-CIV icons per menu key. Keys absent from the
            // map keep whatever upstream ships, so the array above stays
            // byte-identical to upstream and merges cleanly when upstream adds
            // or reorders entries. See base/taknz-nav-icons.ts.
            const override = TAKNZ_NAV_ICONS[item.key];
            return override ? { ...item, icon: override } : item;
        });
    }

    get items(): ComputedRef<MenuItemConfig[]> {
        return computed(() => {
            const native = isNativePlatform();

            let combined = [...this.baseMenuItems, ...this.pluginMenuItems.value].filter((item) => {
                if (item.routeExternal && native) return false;
                if (item.requiresSystemAdmin && !this.isSystemAdmin.value) return false;
                if (item.requiresAgencyAdmin && !(this.isAgencyAdmin.value || this.isSystemAdmin.value)) return false;
                if (item.requiresMedia && !this.mediaEnabled.value) return false;
                return true;
            });

            if (this.preferenceOrder.value.length > 0) {
                const ordered: MenuItemConfig[] = [];
                const map = new Map(combined.map(i => [i.key, i]));

                for (const pref of this.preferenceOrder.value) {
                    if (map.has(pref.key)) {
                        ordered.push({ ...map.get(pref.key)!, visibility: pref.visibility ?? 'full' });
                        map.delete(pref.key);
                    }
                }

                for (const item of map.values()) {
                    ordered.push({ ...item, visibility: 'full' });
                }
                combined = ordered;
            } else {
                combined = combined.map(item => ({ ...item, visibility: 'full' }));
            }

            return combined.map((item) => {
                if (item.key === 'chats' && this.unreadChatsCount?.value > 0) {
                    return {
                        ...item,
                        badge: this.unreadChatsCount.value > 99 ? '99+' : String(this.unreadChatsCount.value)
                    }
                }
                if (item.key === 'contacts' && this.onlineContactsCount?.value > 0) {
                    return {
                        ...item,
                        badge: this.onlineContactsCount.value > 99 ? '99+' : String(this.onlineContactsCount.value)
                    }
                }
                return item;
            });
        });
    }

    get filteredItems(): ComputedRef<MenuItemConfig[]> {
        return computed(() => {
            const term = this.filter.value.trim().toLowerCase();
            if (!term) return this.items.value;

            return this.items.value.filter((item) => {
                const label = item.label.toLowerCase();
                const tooltip = item.tooltip.toLowerCase();
                const description = item.description?.toLowerCase() ?? '';

                return (
                    label.includes(term)
                    || tooltip.includes(term)
                    || description.includes(term)
                );
            });
        });
    }

    setLayout(mode: 'list' | 'tiles') {
        this.preferredLayout.value = mode;

        if (typeof window !== 'undefined') {
            localStorage.setItem('cloudtak-menu-layout', mode);
        }
    }

    addMenuItem(item: MenuItemConfig) {
        this.pluginMenuItems.value.push({
            ...item,
            icon: markRaw(item.icon)
        });
    }

    removeMenuItem(key: string) {
        this.pluginMenuItems.value = this.pluginMenuItems.value.filter(i => i.key !== key);
    }

    async setOrder(keys: string[]) {
        const orderMap = new Map(this.preferenceOrder.value.map(p => [p.key, p]));
        const newOrder = keys.map(k => {
            const existing = orderMap.get(k);
            return existing ? { ...toRaw(existing) } : { key: k, visibility: 'full' as const };
        });

        this.preferenceOrder.value = newOrder;
        const config = new ProfileConfig('menu_order', newOrder);
        await config.commit(newOrder);
    }

    async setVisibility(key: string, visible: "full" | "partial" | "hidden") {
        const index = this.preferenceOrder.value.findIndex(p => p.key === key);
        if (index !== -1) {
            this.preferenceOrder.value[index].visibility = visible;
        } else {
            // Need to reconstruct the full order to save it properly
            // We can iterate the current items (which are ordered as per UI) and update the target key
            const currentItems = this.items.value;
            this.preferenceOrder.value = currentItems.map(item => ({
                key: item.key,
                visibility: (item.key === key ? visible : (item.visibility || 'full')) as "full" | "partial" | "hidden"
            }));
        }

        const rawOrder = this.preferenceOrder.value.map(p => toRaw(p));
        const config = new ProfileConfig('menu_order', rawOrder);
        await config.commit(rawOrder);
    }
}
