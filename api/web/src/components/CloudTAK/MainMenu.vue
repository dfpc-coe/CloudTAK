<template>
    <div
        ref='container'
        class='position-absolute end-0 bottom-0 start-0'
        :class='{
            "start-0 end-0 top-0 bottom-0": resizing
        }'
    />
    <div
        class='position-absolute end-0 bottom-0 text-white d-flex'
        role='menubar'
        :class='{
            "bg-dark": !compact,
        }'
        style='z-index: 1; top: 56px;'
        :style='`
            width: ${compact ? "60px" : `${menuWidth}px`};
            min-width: ${compact ? "60px" : `400px`};
            ${compact ? "background-color: rgb(0, 0, 0, 0.5)" : ""}
        `'
    >
        <div
            v-if='!compact'
            ref='resize'
            class='resize hover cursor-drag'
        />
        <div
            ref='menu'
            class='position-relative w-100 h-100 px-0'
        >
            <template
                v-if='!["home", "home-menu"].includes(String(route.name))'
            >
                <router-view />
            </template>
            <template v-else>
                <div
                    v-if='!compact'
                    class='sticky-top col-12 border-bottom border-light'
                    style='border-radius: 0px;'
                    :class='{
                        "bg-dark": !compact
                    }'
                >
                    <div class='modal-header px-0 mx-2 align-center'>
                        <div class='modal-title' />
                        <div class='modal-title'>
                            Main Menu
                        </div>
                        <div class='d-flex justify-content-end align-items-center menu-layout-toggle'>
                            <template v-if='!compact'>
                                <TablerIconButton
                                    title='List View'
                                    class='hover-button'
                                    :class='{ "btn-active": preferredLayout === "list" }'
                                    :hover='false'
                                    @click='setPreferredLayout("list")'
                                >
                                    <IconLayoutList
                                        :size='20'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                                <TablerIconButton
                                    title='Tile View'
                                    class='hover-button ms-2'
                                    :class='{ "btn-active": preferredLayout === "tiles" }'
                                    :hover='false'
                                    @click='setPreferredLayout("tiles")'
                                >
                                    <IconLayoutGrid
                                        :size='20'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                            </template>
                        </div>
                    </div>
                </div>
                <div
                    class='col-12 overflow-auto noscroll'
                    style='height: calc(100% - 106px)'
                >
                    <div
                        v-if='!compact'
                        class='px-3 pt-3 pb-1'
                    >
                        <TablerInput
                            v-model='menuFilter'
                            placeholder='Search...'
                            icon='search'
                        />
                    </div>
                    <template v-if='menuLayout === "list"'>
                        <template v-if='filteredMenuItems.length'>
                            <div
                                v-for='item in filteredMenuItems'
                                :key='item.key'
                                role='menuitem'
                                :tabindex='compact ? undefined : 0'
                                class='cursor-pointer col-12 d-flex align-items-center'
                                :class='{
                                    "py-2 px-3 hover": !compact,
                                    "py-1 px-2 hover-button": compact,
                                    "position-relative": compact && item.adminBadge
                                }'
                                @click='router.push(item.route)'
                                @keyup.enter='router.push(item.route)'
                            >
                                <component
                                    :is='item.icon'
                                    v-tooltip='{
                                        content: item.tooltip,
                                        placement: "left",
                                    }'
                                    :tabindex='compact ? 0 : undefined'
                                    :title='item.tooltip'
                                    :class='{ "mx-2": compact }'
                                    :size='32'
                                    stroke='1'
                                />
                                <span
                                    v-if='compact && item.adminBadge'
                                    class='position-absolute badge bg-blue text-white'
                                    style='top: 5px; right: 5px; font-size: 10px; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; border-radius: 50%;'
                                >A</span>
                                <span
                                    v-if='!compact'
                                    class='mx-2 user-select-none'
                                    style='font-size: 18px;'
                                    v-text='item.label'
                                />
                                <span
                                    v-if='!compact && item.adminBadge'
                                    class='ms-auto badge border border-blue bg-blue text-white'
                                    v-text='item.adminBadge'
                                />
                            </div>
                        </template>
                        <TablerNone
                            v-else
                            label='No menu items match your search'
                            :create='false'
                            class='px-3'
                        />
                    </template>
                    <template v-else>
                        <div
                            v-if='filteredMenuItems.length'
                            class='menu-tiles px-3 py-3'
                        >
                            <div
                                v-for='item in filteredMenuItems'
                                :key='`tile-${item.key}`'
                                class='menu-tile text-white cursor-pointer user-select-none'
                                role='menuitem'
                                tabindex='0'
                                @click='router.push(item.route)'
                                @keyup.enter='router.push(item.route)'
                            >
                                <component
                                    :is='item.icon'
                                    :size='36'
                                    stroke='1'
                                />
                                <div
                                    class='tile-label mt-2'
                                    v-text='item.label'
                                />
                                <div
                                    v-if='item.description'
                                    class='tile-description'
                                    v-text='item.description'
                                />
                                <span
                                    v-if='item.adminBadge'
                                    class='badge border border-blue bg-blue text-white mt-2'
                                    v-text='item.adminBadge'
                                />
                            </div>
                        </div>
                        <TablerNone
                            v-else
                            label='No menu items match your search'
                            :create='false'
                            class='px-3'
                        />
                    </template>
                </div>
            </template>

            <div
                class='position-absolute bottom-0 start-0 end-0'
                :class='{
                    "bg-dark border-top border-white": !compact && String(route.name) === "home-menu"
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
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, useTemplateRef, onMounted, computed } from 'vue';
import type { Component } from 'vue';
import {
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
const route = useRoute();
const router = useRouter();

const mapStore = useMapStore();
const brandStore = useBrandStore();

const resizing = ref(false);

const menu = useTemplateRef('menu');
const resize = useTemplateRef('resize');
const container = useTemplateRef('container');

const version = ref('');
const username = ref<string>('Username')
const menuWidth = ref<number>(400);
const isSystemAdmin = ref<boolean>(false)
const isAgencyAdmin = ref<boolean>(false)
const menuFilter = ref('');

type MenuItemConfig = {
    key: string;
    label: string;
    route: string;
    tooltip: string;
    description?: string;
    icon: Component;
    adminBadge?: string;
    requiresSystemAdmin?: boolean;
    requiresAgencyAdmin?: boolean;
};

const baseMenuItems: MenuItemConfig[] = [
    {
        key: 'features',
        label: 'Your Features',
        route: '/menu/features',
        tooltip: 'Your Features',
        description: 'Browse and manage your saved features.',
        icon: IconMapPin,
    },
    {
        key: 'overlays',
        label: 'Overlays',
        route: '/menu/overlays',
        tooltip: 'Overlays',
        description: 'Toggle and configure mission overlays.',
        icon: IconBoxMultiple,
    },
    {
        key: 'contacts',
        label: 'Contacts',
        route: '/menu/contacts',
        tooltip: 'Contacts',
        description: 'Manage and search for TAK contacts.',
        icon: IconUsers,
    },
    {
        key: 'basemaps',
        label: 'BaseMaps',
        route: '/menu/basemaps',
        tooltip: 'Basemaps',
        description: 'Switch between available basemaps.',
        icon: IconMap,
    },
    {
        key: 'missions',
        label: 'Data Sync',
        route: '/menu/missions',
        tooltip: 'Data Sync',
        description: 'Manage mission data synchronizations.',
        icon: IconAmbulance,
    },
    {
        key: 'packages',
        label: 'Data Package',
        route: '/menu/packages',
        tooltip: 'Data Packages',
        description: 'Create and share TAK data packages.',
        icon: IconPackages,
    },
    {
        key: 'channels',
        label: 'Channels',
        route: '/menu/channels',
        tooltip: 'Channels',
        description: 'Join and manage TAK data channels.',
        icon: IconAffiliate,
    },
    {
        key: 'videos',
        label: 'Videos',
        route: '/menu/videos',
        tooltip: 'Videos',
        description: 'Access live and recorded video feeds.',
        icon: IconVideo,
    },
    {
        key: 'chats',
        label: 'Chats',
        route: '/menu/chats',
        tooltip: 'Chats',
        description: 'Open TAK chat threads and history.',
        icon: IconMessage,
    },
    {
        key: 'routes',
        label: 'Routes',
        route: '/menu/routes',
        tooltip: 'Routes',
        description: 'Plan and manage route overlays.',
        icon: IconRoute,
    },
    {
        key: 'files',
        label: 'Uploaded Files',
        route: '/menu/files',
        tooltip: 'Your Files',
        description: 'Browse files you have uploaded.',
        icon: IconFiles,
    },
    {
        key: 'imports',
        label: 'Imports',
        route: '/menu/imports',
        tooltip: 'Imports',
        description: 'Review and manage data imports.',
        icon: IconFileImport,
    },
    {
        key: 'iconsets',
        label: 'Iconsets',
        route: '/menu/iconsets',
        tooltip: 'Iconsets',
        description: 'Customize icon collections.',
        icon: IconPhoto,
    },
    {
        key: 'connections',
        label: 'Connections',
        route: '/menu/connections',
        tooltip: 'Connections (Admin)',
        description: 'Manage TAK connections and bridges.',
        icon: IconNetwork,
        adminBadge: 'Admin',
        requiresAgencyAdmin: true,
    },
    {
        key: 'debugger',
        label: 'COT Debugger',
        route: '/menu/debugger',
        tooltip: 'Debugger (Admin)',
        description: 'Inspect and debug COT traffic.',
        icon: IconBug,
        adminBadge: 'Admin',
        requiresSystemAdmin: true,
    },
    {
        key: 'server',
        label: 'Server',
        route: '/admin',
        tooltip: 'Server Settings (Admin)',
        description: 'Configure CloudTAK server settings.',
        icon: IconServerCog,
        adminBadge: 'Admin',
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
})

const storedLayoutPref = typeof window !== 'undefined' ? localStorage.getItem('cloudtak-menu-layout') : null;
const preferredLayout = ref<'list' | 'tiles'>(storedLayoutPref === 'tiles' ? 'tiles' : 'list');
const menuLayout = computed(() => props.compact ? 'list' : preferredLayout.value);

const menuItems = computed(() => {
    return baseMenuItems.filter((item) => {
        if (item.requiresSystemAdmin && !isSystemAdmin.value) return false;
        if (item.requiresAgencyAdmin && !(isAgencyAdmin.value || isSystemAdmin.value)) return false;
        return true;
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

watch(props, () => {
    if (props.compact && mapStore.toastOffset.x !== 70) {
        mapStore.toastOffset.x = 70;
    } else if (!props.compact && mapStore.toastOffset.x !== menuWidth.value + 10) {
        mapStore.toastOffset.x = menuWidth.value + 10;
    }
});

watch(menuWidth, () => {
    mapStore.toastOffset.x = menuWidth.value + 10;
});

watch(resize, () => {
    if (resize.value && container.value && menu.value) {
        resizing.value = false;

        let beginWidth = menuWidth.value;
        let beginX = resize.value.getBoundingClientRect().x;
        let deltaX = 0;

        resize.value.addEventListener("mousedown", () => {
            if (!resize.value) return;
            beginWidth = menuWidth.value;
            beginX = resize.value.getBoundingClientRect().x;
            deltaX = 0;
            resizing.value = true;
        });

        menu.value.addEventListener("mousemove", (e) => {
            deltaX = beginX - e.x;

            if (resizing.value) {
                menuWidth.value = beginWidth + deltaX;
                e.preventDefault();
            }
        });

        container.value.addEventListener("mousemove", (e) => {
            deltaX = beginX - e.x;

            if (resizing.value) {
                menuWidth.value = beginWidth + deltaX;
                e.preventDefault();
            }
        });

        resize.value.addEventListener("mouseup", () => {
            resizing.value = false;
        });

        menu.value.addEventListener("mouseup", () => {
            resizing.value = false;
        });

        container.value.addEventListener("mouseup", () => {
            resizing.value = false;
        });
    }
})

onMounted(async () => {
    mapStore.toastOffset.x = props.compact ? 70 : menuWidth.value + 10;

    version.value = (await mapStore.worker.profile.loadServer()).version;
    username.value = await mapStore.worker.profile.username();
    isSystemAdmin.value = await mapStore.worker.profile.isSystemAdmin();
    isAgencyAdmin.value = await mapStore.worker.profile.isAgencyAdmin();
})

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

.resize {
   height: 100%;
   width: 14px;
   cursor: col-resize;
   flex-shrink: 0;
   position: relative;
   z-index: 10;
   user-select: none;
}
.resize::before {
   content: "";
   position: absolute;
   top: 50%;
   left: 50%;
   transform: translate(-50%, -50%);
   width: 3px;
   height: 15px;
   border-inline: 1px solid #fff;
}
.right {
   flex-grow: 1;
}

.menu-layout-toggle .btn-active {
    background-color: rgba(255, 255, 255, 0.18);
    border-color: rgba(255, 255, 255, 0.35);
}

.menu-tiles {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
}

.menu-tile {
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    background-color: rgba(0, 0, 0, 0.35);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.menu-tile:hover,
.menu-tile:focus {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.4);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}

.tile-label {
    font-size: 1rem;
    font-weight: 600;
}

.tile-description {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.78);
}

</style>
