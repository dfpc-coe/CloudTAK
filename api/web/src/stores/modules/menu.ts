import { ref, computed } from 'vue';
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

export type MenuItemConfig = {
    key: string;
    label: string;
    route: string;
    routeExternal?: boolean;
    tooltip: string;
    description?: string;
    icon: Component;
    badge?: string;
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(mapStore: any) {
        this.mapStore = mapStore;
        this.filter = ref('');
        this.onlineContactsCount = ref(0);
        this.isSystemAdmin = ref(false);
        this.isAgencyAdmin = ref(false);
        this.pluginMenuItems = ref([]);

        const storedLayoutPref = typeof window !== 'undefined' ? localStorage.getItem('cloudtak-menu-layout') : null;
        this.preferredLayout = ref<'list' | 'tiles'>(storedLayoutPref === 'tiles' ? 'tiles' : 'list');
    }

    async init() {
        this.isSystemAdmin.value = await this.mapStore.worker.profile.isSystemAdmin();
        this.isAgencyAdmin.value = await this.mapStore.worker.profile.isAgencyAdmin();
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
            return [...this.baseMenuItems, ...this.pluginMenuItems.value].filter((item) => {
                if (item.requiresSystemAdmin && !this.isSystemAdmin.value) return false;
                if (item.requiresAgencyAdmin && !(this.isAgencyAdmin.value || this.isSystemAdmin.value)) return false;
                return true;
            }).map((item) => {
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

    get filtered(): ComputedRef<MenuItemConfig[]> {
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
}
