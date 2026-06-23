<template>
    <div
        v-if='compact'
        class='main-menu-layout d-flex flex-column h-100 overflow-hidden'
    >
        <div
            class='main-menu-scroll flex-grow-1 w-100 overflow-auto noscroll pb-2'
        >
            <MenuItemCard
                v-for='item in visibleCompactMenuItems'
                :key='`compact-${item.key}`'
                :icon='item.icon'
                :label='item.label'
                :tooltip='item.tooltip'
                :badge='item.badge'
                :layout='"list"'
                :compact='true'
                @select='handleSelect(item)'
            />
        </div>

        <div class='main-menu-footer flex-shrink-0'>
            <div class='d-flex justify-content-center mb-2'>
                <TablerDropdown
                    position='left'
                >
                    <template #default>
                        <TablerIconButton
                            title='Application Switcher'
                            class='cloudtak-hover'
                            :hover='false'
                        >
                            <IconGridDots
                                :size='32'
                                stroke='1'
                            />
                        </TablerIconButton>
                    </template>
                    <template #dropdown>
                        <div
                            class='py-1'
                            style='min-width: 200px;'
                        >
                            <div class='px-3 pt-2 pb-1 fw-bold'>
                                Applications
                            </div>
                            <div class='px-2 pb-2'>
                                <div
                                    v-for='application in appSwitcherApplications'
                                    :key='application.url'
                                    class='col-12 py-1 px-2 cloudtak-hover cursor-pointer user-select-none'
                                    @click.stop='external(application.url)'
                                >
                                    <img
                                        v-if='application.icon'
                                        :src='application.icon'
                                        :alt='`${application.name} logo`'
                                        class='app-switcher-logo'
                                    >
                                    <IconWorld
                                        v-else
                                        :size='25'
                                        stroke='1'
                                    />
                                    <span class='ps-2'>{{ application.name }}</span>
                                </div>
                                <div
                                    v-if='appSwitcherApplications.length'
                                    class='dropdown-divider my-1'
                                />
                                <div
                                    class='col-12 py-1 px-2 cloudtak-hover cursor-pointer user-select-none'
                                    @click.stop='external("/video")'
                                >
                                    <IconDeviceTv
                                        :size='25'
                                        stroke='1'
                                    />
                                    <span class='ps-2'>Video Wall</span>
                                </div>
                            </div>
                        </div>
                    </template>
                </TablerDropdown>
            </div>
            <div class='d-flex justify-content-center mb-1'>
                <ServerStatus
                    :version='true'
                    :size='50'
                />
            </div>
        </div>
    </div>

    <MenuTemplate
        v-else
        name='Main Menu'
        :back='false'
    >
        <template #buttons>
            <TablerIconButton
                v-if='preferredLayout !== "list"'
                title='List View'
                @click='mapStore.menu.setLayout("list")'
            >
                <IconLayoutList
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerIconButton
                v-if='canEditOrder'
                :title='isDraggable ? "Save Order" : "Reorder Items"'
                :variant='isDraggable ? "primary" : "secondary"'
                @click='handleReorderToggle'
            >
                <IconPencil
                    v-if='!isDraggable'
                    :size='32'
                    stroke='1'
                />
                <IconPencilCheck
                    v-else
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerIconButton
                v-if='preferredLayout !== "tiles"'
                title='Tile View'
                @click='mapStore.menu.setLayout("tiles")'
            >
                <IconLayoutGrid
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
        </template>

        <div
            class='px-3 pt-3 pb-2'
        >
            <TablerInput
                v-model='menuFilter'
                placeholder='Search...'
                :autofocus='!appStore.isMobileDetected'
                icon='search'
                class='mb-0'
            />
        </div>
        <div
            v-if='visibleFilteredMenuItems.length'
            ref='sortableRef'
            class='pb-3'
            :class='{
                "menu-tiles px-3 py-3": menuLayout === "tiles",
                "d-flex flex-column gap-2 mx-3": menuLayout === "list"
            }'
        >
            <MenuItemCard
                v-for='item in visibleFilteredMenuItems'
                :key='`tile-${item.key}`'
                :data-key='item.key'
                :class='{
                    "cursor-move": isDraggable,
                    "text-muted": item.visibility === "hidden"
                }'
                :description-class='item.visibility === "hidden" ? "text-muted" : ""'
                :icon='item.icon'
                :label='item.label'
                :description='item.description'
                :tooltip='item.tooltip'
                :badge='item.badge'
                :layout='menuLayout'
                :compact='false'
                @select='handleSelect(item)'
            >
                <template #prefix>
                    <div
                        v-if='isDraggable'
                        class='d-flex align-items-center'
                    >
                        <IconGripVertical
                            stroke='1'
                            :size='20'
                            class='text-muted cursor-move drag-handle me-2'
                        />
                        <div
                            class='cursor-pointer'
                            @click.stop='cycleVisibility(item)'
                        >
                            <IconEye
                                v-if='!item.visibility || item.visibility === "full"'
                                :size='20'
                                stroke='1'
                            />
                            <IconEyeDotted
                                v-else-if='item.visibility === "partial"'
                                :size='20'
                                stroke='1'
                            />
                            <IconEyeOff
                                v-else
                                :size='20'
                                stroke='1'
                            />
                        </div>
                    </div>
                </template>
            </MenuItemCard>
        </div>
        <TablerNone
            v-else
            label='No Menu Items'
            :create='false'
            class='px-3'
        />

        <template #footer>
            <div
                class='main-menu-footer flex-shrink-0 cloudtak-bg border-top border-white'
            >
                <div
                    class='row g-0 align-items-center'
                >
                    <div
                        style='width: calc(100% - 40px)'
                        class='py-2 d-flex align-items-center overflow-hidden'
                    >
                        <div class='d-flex align-items-center overflow-hidden w-100'>
                            <IconUser
                                title='User Icon'
                                :size='32'
                                stroke='1'
                                class='mx-2'
                            />
                            <span
                                class='text-truncate'
                                style='font-size: 18px;'
                                v-text='username'
                            />
                        </div>
                    </div>

                    <div
                        role='button'
                        style='width: 40px;'
                        class='py-2 px-2 ms-auto d-flex cloudtak-hover cursor-pointer'
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
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted, onUnmounted, computed, watch, onBeforeUnmount } from 'vue';
import {
    IconUser,
    IconLogout,
    IconGridDots,
    IconWorld,
    IconDeviceTv,
    IconLayoutGrid,
    IconLayoutList,
    IconPencil, 
    IconPencilCheck,
    IconGripVertical,
    IconEye,
    IconEyeDotted,
    IconEyeOff
} from '@tabler/icons-vue';
import Sortable from 'sortablejs';
import {
    TablerDropdown,
    TablerIconButton,
    TablerInput,
    TablerNone,
} from '@tak-ps/vue-tabler';
import { openSecondaryView } from '../../base/capacitor.ts';
import { useMapStore } from '../../stores/map.ts';
import { useAppStore } from '../../stores/app.ts';
import type { MenuItemConfig } from '../../stores/modules/menu.ts';
import Config from '../../base/config.ts';
import { useRouter } from 'vue-router';
import MenuItemCard from './Menu/MenuItemCard.vue';
import MenuTemplate from './util/MenuTemplate.vue';
import ServerStatus from './ServerStatus.vue';
import ProfileConfig from '../../base/profile.ts';

const router = useRouter();

const mapStore = useMapStore();
const appStore = useAppStore();

type AppSwitcherApplication = {
    name: string;
    icon: string;
    url: string;
};

const appSwitcherApplications = ref<AppSwitcherApplication[]>([]);

let alive = false;
onMounted(() => { alive = true; });
onUnmounted(() => { alive = false; });

onMounted(async () => {
    const applicationsConfig = await Config.list(['external::applications' as never]);

    if (!alive) return;

    appSwitcherApplications.value = normalizeApplications(applicationsConfig['external::applications' as never]);
});

const username = ref<string>('Username');

const props = defineProps({
    compact: Boolean
});

const menuLayout = computed(() => props.compact ? 'list' : mapStore.menu.preferredLayout.value);
const preferredLayout = computed(() => mapStore.menu.preferredLayout.value);
const menuFilter = computed({
    get: () => mapStore.menu.filter.value,
    set: (val) => mapStore.menu.filter.value = val
});
const filteredMenuItems = computed(() => mapStore.menu.filteredItems.value);
const menuItems = computed(() => mapStore.menu.items.value);

const visibleFilteredMenuItems = computed(() => {
    if (isDraggable.value) return filteredMenuItems.value;
    return filteredMenuItems.value.filter((item: MenuItemConfig) => item.visibility !== 'hidden');
});

const visibleCompactMenuItems = computed(() => {
    return menuItems.value.filter((item: MenuItemConfig) => item.visibility !== 'hidden' && item.visibility !== 'partial');
});

let sortable: Sortable | undefined;
const sortableRef = ref<HTMLElement | null>(null);
const isDraggable = ref(false);

const canEditOrder = computed(() => !menuFilter.value.trim().length && filteredMenuItems.value.length > 1);

watch(menuFilter, () => {
    if (isDraggable.value && !canEditOrder.value) {
        isDraggable.value = false;
    }
});

watch(
    () => ({
        container: sortableRef.value,
        draggable: isDraggable.value,
        hasSearch: !!menuFilter.value.trim().length,
    }),
    ({ container, draggable, hasSearch }) => {
        const canSort = !!container && draggable && !hasSearch;
        if (canSort && container) {
            if (sortable && sortable.el === container) return;
            if (sortable) sortable.destroy();
            sortable = new Sortable(container, {
                sort: true,
                animation: 150,
                handle: '.drag-handle',
                dataIdAttr: 'data-key',
                onEnd: saveOrder
            });
        } else if (sortable) {
            sortable.destroy();
            sortable = undefined;
        }
    },
    { immediate: true, flush: 'post' }
);

onBeforeUnmount(() => {
    if (sortable) sortable.destroy();
});

function handleReorderToggle() {
    if (isDraggable.value) {
        isDraggable.value = false;
        saveOrder();
        return;
    }
    if (!canEditOrder.value) return;
    isDraggable.value = true;
}

async function saveOrder() {
   if (!sortable) return;
   const keys = sortable.toArray();
   await mapStore.menu.setOrder(keys);
}

onMounted(async () => {
    const usernameConfig = await ProfileConfig.get('username');
    if (alive && usernameConfig) {
        username.value = usernameConfig.value;
    }
})

function cycleVisibility(item: MenuItemConfig) {
    const nextMap: Record<string, "full" | "partial" | "hidden"> = {
        'full': 'partial',
        'partial': 'hidden',
        'hidden': 'full'
    };
    const next = nextMap[item.visibility || 'full'] || 'full';
    mapStore.menu.setVisibility(item.key, next);
}

function external(url: string) {
    void openSecondaryView(String(new URL(url, window.location.origin)));
}

function handleSelect(item: MenuItemConfig) {
    if (isDraggable.value) return;

    if (item.routeExternal) {
        external(item.route);
    } else {
        router.push(item.route.startsWith("/") ? item.route : { name: item.route });
    }
}

async function logout() {
    await appStore.logout();
}

function normalizeApplications(applications: unknown): AppSwitcherApplication[] {
    if (!Array.isArray(applications)) return [];

    return applications.map((application) => {
        const value = application as Partial<AppSwitcherApplication> | null;

        return {
            name: typeof value?.name === 'string' ? value.name : '',
            icon: typeof value?.icon === 'string' ? value.icon : '',
            url: typeof value?.url === 'string' ? value.url : '',
        };
    });
}
</script>

<style scoped>
.noscroll {
    -ms-overflow-style: none;  /* Internet Explorer 10+ */
    scrollbar-width: none;  /* Firefox, Safari 18.2+, Chromium 121+ */
}
.noscroll::-webkit-scrollbar {
    display: none;  /* Older Safari and Chromium */
}

.main-menu-layout {
    min-height: 0;
}

.main-menu-scroll {
    min-height: 0;
}

.main-menu-footer {
    min-height: 0;
}

@media (max-width: 767.98px) {
    .main-menu-footer {
        padding-bottom: env(safe-area-inset-bottom);
    }
}

.menu-tiles {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
}

.cursor-move {
    cursor: move !important;
}

.app-switcher-logo {
    width: 32px;
    height: 32px;
    object-fit: contain;
    flex-shrink: 0;
}
</style>
