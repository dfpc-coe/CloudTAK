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
import { ref, onMounted, computed } from 'vue';
import {
    IconX,
    IconUser,
    IconLogout,
    IconGridDots,
    IconDeviceTv,
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

const route = useRoute();
const router = useRouter();

const mapStore = useMapStore();
const brandStore = useBrandStore();

const emit = defineEmits<{
    (e: 'close'): void;
}>();

const version = ref('');
const username = ref<string>('Username')

const props = defineProps({
    compact: Boolean,
    modal: Boolean
})

const menuLayout = computed(() => props.compact ? 'list' : mapStore.menu.preferredLayout.value);
const preferredLayout = computed(() => mapStore.menu.preferredLayout.value);
const menuFilter = computed({
    get: () => mapStore.menu.filter.value,
    set: (val) => mapStore.menu.filter.value = val
});
const filteredMenuItems = computed(() => mapStore.menu.filtered.value);
const menuItems = computed(() => mapStore.menu.items.value);

onMounted(async () => {
    version.value = (await mapStore.worker.profile.loadServer()).version;
    username.value = await mapStore.worker.profile.username();
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

.menu-tiles {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
}
</style>
