import { ref, computed, toRaw } from 'vue';
import type { Component, Ref, ComputedRef } from "vue";
import {
    IconBug,
    IconMap,
    IconFiles,
    IconUsers,
    IconVideo,
    IconPhoto,
    IconRoute,
    IconMapPin,
    IconMessage,
    IconNetwork,
    IconPackages,
    IconSettings,
    IconAmbulance,
    IconServerCog,
    IconBoxMultiple,
    IconFileImport,
    IconAffiliate,
} from '@tabler/icons-vue';
import ProfileConfig from '../../base/profile.ts';
import type { Profile } from '../../types.ts';

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
    isSystemAdmin: Ref<boolean>;
    isAgencyAdmin: Ref<boolean>;
    pluginMenuItems: Ref<MenuItemConfig[]>;
    preferenceOrder: Ref<Profile['menu_order']>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(mapStore: any) {
        this.mapStore = mapStore;
        this.filter = ref('');
        this.onlineContactsCount = ref(0);
        this.isSystemAdmin = ref(false);
        this.isAgencyAdmin = ref(false);
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
            const menuOrder = await ProfileConfig.get('menu_order');
            if (menuOrder && menuOrder.value) {
                this.preferenceOrder.value = menuOrder.value;
            }
        } catch (e) {
            console.error('Failed to load menu order', e);
        }

        await this.updateContactsCount();
    }

    get baseMenuItems(): MenuItemConfig[] {
        return [
            {
                key: 'features',
                label: 'Your Features',
                route: '/menu/features',
                tooltip: 'Your Features',
                description: 'Manage saved features',
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
                icon: IconAmbulance,
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
                label: 'Uploaded Files',
                route: '/menu/files',
                tooltip: 'Your Files',
                description: 'Browse files you have uploaded',
                icon: IconFiles,
            },
            {
                key: 'imports',
                label: 'Imports',
                route: '/menu/imports',
                tooltip: 'Imports',
                description: 'Review and manage data imports',
                icon: IconFileImport,
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
                label: 'Server',
                route: '/admin',
                routeExternal: true,
                tooltip: 'Server Settings (Admin)',
                description: 'Configure CloudTAK server settings.',
                icon: IconServerCog,
                badge: 'A',
                requiresSystemAdmin: true,
            },
            {
                key: 'settings',
                label: 'Settings',
                route: '/menu/settings',
                tooltip: 'Display Settings',
                description: 'Adjust personal display preferences.',
                icon: IconSettings,
            },
        ];
    }

    get items(): ComputedRef<MenuItemConfig[]> {
        return computed(() => {
            let combined = [...this.baseMenuItems, ...this.pluginMenuItems.value].filter((item) => {
                if (item.requiresSystemAdmin && !this.isSystemAdmin.value) return false;
                if (item.requiresAgencyAdmin && !(this.isAgencyAdmin.value || this.isSystemAdmin.value)) return false;
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
                if (item.key === 'contacts' && this.onlineContactsCount.value > 0) {
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

    async updateContactsCount() {
        const team = await this.mapStore.worker.team.load();
        const self = await this.mapStore.worker.profile.uid();
        let count = 0;
        for (const contact of team.values()) {
            if (contact.uid === self) continue;
            if (await this.mapStore.worker.db.has(contact.uid)) {
                count++;
            }
        }
        this.onlineContactsCount.value = count;
    }

    addMenuItem(item: MenuItemConfig) {
        this.pluginMenuItems.value.push(item);
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
