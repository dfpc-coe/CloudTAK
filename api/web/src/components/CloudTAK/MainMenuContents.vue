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
        </div>
        <div
            v-else
            class='col-12 overflow-auto noscroll'
            style='height: calc(100% - 106px)'
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
import { ref, onMounted, computed, watch, onBeforeUnmount } from 'vue';
import {
    IconX,
    IconUser,
    IconLogout,
    IconGridDots,
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
import { useMapStore } from '../../stores/map.ts';
import type { MenuItemConfig } from '../../stores/modules/menu.ts';
import { useBrandStore } from '../../stores/brand.ts';
import { useRouter, useRoute } from 'vue-router';
import MenuItemCard from './Menu/MenuItemCard.vue';
import ProfileConfig from '../../base/profile.ts';

const route = useRoute();
const router = useRouter();

const mapStore = useMapStore();
const brandStore = useBrandStore();

const emit = defineEmits<{
    (e: 'close'): void;
}>();

const version = ref('');
const username = ref<string>('Username');

const props = defineProps({
    compact: Boolean,
    modal: Boolean
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
    if ('serviceWorker' in navigator) {
        const pkg = await navigator.serviceWorker.getRegistration();
        if (pkg && pkg.active) {
            const url = new URL(pkg.active.scriptURL);
            if (url.searchParams.get('v')) {
                version.value = String(url.searchParams.get('v'));
            }
        }
    }

    if (!version.value) {
        version.value = (await mapStore.worker.profile.loadServer()).version;
    }

    const usernameConfig = await ProfileConfig.get('username');
    if (usernameConfig) {
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
    window.open(String(new URL(url, window.location.origin)));
}

function handleSelect(item: MenuItemConfig) {
    if (isDraggable.value) return;

    if (item.routeExternal) {
        external(item.route);
    } else {
        router.push(item.route.startsWith("/") ? item.route : { name: item.route });
    }
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

.cursor-move {
    cursor: move !important;
}
</style>
