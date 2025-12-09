<template>
    <template
        v-if='!["home", "home-menu"].includes(String(route.name))'
    >
        <template v-if='modal'>
            <div class='modal-header'>
                <div class='modal-title'>
                    Main Menu
                </div>

                <button
                    type='button'
                    class='btn-close'
                    aria-label='Close'
                    @click='emit("close")'
                />
            </div>

            <router-view />
        </template>
        <template v-else>
            <router-view />
        </template>
    </template>
    <template v-else>
        <div
            v-if='!compact'
            class='sticky-top col-12 border-bottom border-light'
            :class='{
                "bg-dark rounded-0": !compact,
                "rounded-0": !modal,
                "rounded-top": modal
            }'
        >
            <div class='modal-header px-0 mx-2 align-center'>
                <div class='modal-title'>
                    Main Menu
                </div>

                <div class='ms-auto btn-list d-flex align-items-center menu-layout-toggle'>
                    <TablerIconButton
                        v-if='preferredLayout !== "list"'
                        title='List View'
                        @click='setPreferredLayout("list")'
                    >
                        <IconLayoutList
                            :size='32'
                            stroke='1'
                        />
                    </TablerIconButton>
                    <TablerIconButton
                        v-if='preferredLayout !== "tiles"'
                        title='Tile View'
                        @click='setPreferredLayout("tiles")'
                    >
                        <IconLayoutGrid
                            :size='32'
                            stroke='1'
                        />
                    </TablerIconButton>

                    <TablerIconButton
                        v-if='props.modal'
                        title='Close Menu'
                        @click='emit("close")'
                    >
                        <IconX
                            :size='32'
                            stroke='1'
                        />
                    </TablerIconButton>
                </div>
            </div>
        </div>
        <div
            v-if='!compact'
            class='col-12 overflow-auto noscroll'
            style='height: calc(100% - 106px)'
        >
            <div
                class='px-3 pt-3 pb-2'
            >
                <TablerInput
                    v-model='menuFilter'
                    placeholder='Search...'
                    :autofocus='!mapStore.isMobileDetected'
                    icon='search'
                    class='mb-0'
                />
            </div>
            <div
                v-if='filteredMenuItems.length'
                class='pb-3'
                :class='{
                    "menu-tiles px-3 py-3": menuLayout === "tiles",
                    "d-flex flex-column gap-2 mx-3": menuLayout === "list"
                }'
            >
                <MenuItemCard
                    v-for='item in filteredMenuItems'
                    :key='`tile-${item.key}`'
                    :icon='item.icon'
                    :label='item.label'
                    :description='item.description'
                    :tooltip='item.tooltip'
                    :badge='item.badge'
                    :layout='menuLayout'
                    :compact='false'
                    @select='item.routeExternal ? external(item.route) : router.push(item.route)'
                />
            </div>
            <TablerNone
                v-else
                label='menu items match your search'
                :create='false'
                class='px-3'
            />
        </div>
        <div
            v-else
            class='col-12 overflow-auto noscroll'
            style='height: calc(100% - 106px)'
        >
            <MenuItemCard
                v-for='item in menuItems'
                :key='`compact-${item.key}`'
                :icon='item.icon'
                :label='item.label'
                :tooltip='item.tooltip'
                :badge='item.badge'
                :layout='"list"'
                :compact='true'
                @select='item.routeExternal ? external(item.route) : router.push(item.route)'
            />
        </div>
    </template>

    <div
        class='position-absolute bottom-0 start-0 end-0'
        :class='{
            "bg-dark border-top border-white": !compact && String(route.name) === "home-menu",
            "rounded-0": !modal,
            "rounded-bottom": modal
        }'
    >
        <div
            v-if='String(route.name) === "home-menu" && !compact'
            class='row g-0 align-items-center'
        >
            <div
                style='width: calc(100% - 40px)'
                class='py-2 d-flex align-items-center'
            >
                <div class='d-flex align-items-center'>
                    <IconUser
                        title='User Icon'
                        :size='32'
                        stroke='1'
                        class='mx-2'
                    />
                    <span
                        style='font-size: 18px;'
                        v-text='username'
                    />
                </div>
            </div>

            <div
                role='button'
                style='width: 40px;'
                class='py-2 px-2 ms-auto d-flex hover cursor-pointer'
                @click.stop.prevent='logout'
                @keyup.enter='logout'
            >
                <IconLogout
                    v-tooltip='"Logout"'
                    tabindex='0'
                    title='Logout'
                    :size='32'
                    stroke='1'
                />
            </div>
        </div>
        <div
            v-else-if='["home", "home-menu"].includes(String(route.name))'
        >
            <div class='d-flex justify-content-center mb-2'>
                <TablerDropdown
                    position='right'
                >
                    <template #default>
                        <TablerIconButton
                            title='Application Switcher'
                            class='hover-button'
                            :hover='false'
                        >
                            <IconGridDots
                                :size='32'
                                stroke='1'
                            />
                        </TablerIconButton>
                    </template>
                    <template #dropdown>
                        <div class='card'>
                            <div class='card-body'>
                                <div
                                    class='px-2 py-2 d-flex align-items-center hover rounded cursor-pointer'
                                    @click='external("/video")'
                                >
                                    <IconDeviceTv
                                        size='32'
                                        stroke='1'
                                    />
                                    <div class='mx-2'>
                                        Video Wall
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>
                </TablerDropdown>
            </div>
            <div class='d-flex justify-content-center mb-2'>
                <div class='position-relative'>
                    <img
                        v-tooltip='"Return Home"'
                        class='cursor-pointer'
                        height='50'
                        width='50'
                        :src='brandStore.login && brandStore.login.logo ? brandStore.login.logo : "/CloudTAKLogo.svg"'
                        @click='returnHome'
                        @keyup.enter='returnHome'
                    >
                </div>
                <div
                    class='position-absolute'
                    style='
                        bottom: 20px;
                        right: 10px;
                    '
                >
                    <div
                        class='status'
                        :class='{
                            "status-green": mapStore.isOpen,
                            "status-red": !mapStore.isOpen
                        }'
                    />
                </div>
            </div>
            <div class='d-flex justify-content-center mb-1'>
                <div
                    class='subheader text-white'
                    v-text='version'
                />
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import type { Component } from 'vue';
import {
    IconX,
    IconBug,
    IconMap,
    IconUser,
    IconFiles,
    IconUsers,
    IconVideo,
    IconPhoto,
    IconRoute,
    IconMapPin,
    IconLogout,
    IconMessage,
    IconNetwork,
    IconPackages,
    IconGridDots,
    IconSettings,
    IconDeviceTv,
    IconAmbulance,
    IconServerCog,
    IconBoxMultiple,
    IconFileImport,
    IconAffiliate,
    IconLayoutGrid,
    IconLayoutList,
} from '@tabler/icons-vue';
import {
    TablerDropdown,
    TablerIconButton,
    TablerInput,
    TablerNone,
} from '@tak-ps/vue-tabler';
import { useMapStore } from '../../stores/map.ts';
import { useBrandStore } from '../../stores/brand.ts';
import { useRouter, useRoute } from 'vue-router';
import MenuItemCard from './Menu/MenuItemCard.vue';
import type { WorkerMessage } from '../../base/events.ts';
import { WorkerMessageType } from '../../base/events.ts';

const route = useRoute();
const router = useRouter();

const mapStore = useMapStore();
const brandStore = useBrandStore();

const emit = defineEmits<{
    (e: 'close'): void;
}>();

const version = ref('');
const username = ref<string>('Username')
const isSystemAdmin = ref<boolean>(false)
const isAgencyAdmin = ref<boolean>(false)
const menuFilter = ref('');
const onlineContactsCount = ref(0);

const channel = new BroadcastChannel("cloudtak");

channel.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    if (msg.type === WorkerMessageType.Contact_Change) {
        await updateContactsCount();
    }
}

type MenuItemConfig = {
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

const baseMenuItems: MenuItemConfig[] = [
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

const props = defineProps({
    compact: Boolean,
    modal: Boolean
})

const storedLayoutPref = typeof window !== 'undefined' ? localStorage.getItem('cloudtak-menu-layout') : null;

const preferredLayout = ref<'list' | 'tiles'>(storedLayoutPref === 'tiles' ? 'tiles' : 'list');
const menuLayout = computed(() => props.compact ? 'list' : preferredLayout.value);

const menuItems = computed(() => {
    return baseMenuItems.filter((item) => {
        if (item.requiresSystemAdmin && !isSystemAdmin.value) return false;
        if (item.requiresAgencyAdmin && !(isAgencyAdmin.value || isSystemAdmin.value)) return false;
        return true;
    }).map((item) => {
        if (item.key === 'contacts' && onlineContactsCount.value > 0) {
            return {
                ...item,
                badge: onlineContactsCount.value > 99 ? '99+' : String(onlineContactsCount.value)
            }
        }
        return item;
    });
});

const filteredMenuItems = computed(() => {
    const term = menuFilter.value.trim().toLowerCase();
    if (!term) return menuItems.value;

    return menuItems.value.filter((item) => {
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

function setPreferredLayout(mode: 'list' | 'tiles') {
    preferredLayout.value = mode;

    if (typeof window !== 'undefined') {
        localStorage.setItem('cloudtak-menu-layout', mode);
    }
}

onMounted(async () => {
    version.value = (await mapStore.worker.profile.loadServer()).version;
    username.value = await mapStore.worker.profile.username();
    isSystemAdmin.value = await mapStore.worker.profile.isSystemAdmin();
    isAgencyAdmin.value = await mapStore.worker.profile.isAgencyAdmin();
    await updateContactsCount();
})

onBeforeUnmount(() => {
    if (channel) {
        channel.close();
    }
})

async function updateContactsCount() {
    const team = await mapStore.worker.team.load();
    const self = await mapStore.worker.profile.uid();
    let count = 0;
    for (const contact of team.values()) {
        if (contact.uid === self) continue;
        if (await mapStore.worker.db.has(contact.uid)) {
            count++;
        }
    }
    onlineContactsCount.value = count;
}

function external(url: string) {
    window.open(String(new URL(url, window.location.origin)));
}

function returnHome() {
    router.push("/");
    mapStore.returnHome();
}

function logout() {
    delete localStorage.token;
    router.push("/login");
}
</script>

<style scoped>
.status {
    height: 10px;
    width: 10px;
    margin: 0px;
    padding: 0px;
    border-radius: 50%;
}

.status-green {
    background-color: #2fb344;
}

.status-red {
    background-color: #d63939;
}

.noscroll {
    -ms-overflow-style: none;  /* Internet Explorer 10+ */
    scrollbar-width: none;  /* Firefox, Safari 18.2+, Chromium 121+ */
}
.noscroll::-webkit-scrollbar {
    display: none;  /* Older Safari and Chromium */
}

.menu-tiles {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
}
</style>
