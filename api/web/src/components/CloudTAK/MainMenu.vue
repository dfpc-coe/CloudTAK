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
                        <div />
                    </div>
                </div>
                <div
                    class='col-12 overflow-auto noscroll'
                    style='height: calc(100% - 106px)'
                >
                    <div
                        role='menuitem'
                        :tabindex='compact ? undefined : 0'
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='router.push("/menu/features")'
                        @keyup.enter='router.push("/menu/features")'
                    >
                        <IconMapPin
                            v-tooltip='{
                                content: "Your Features",
                                placement: "left",
                            }'
                            :tabindex='compact ? 0 : undefined'
                            title='Open Features Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2 user-select-none'
                            style='font-size: 18px;'
                        >Your Features</span>
                    </div>
                    <div
                        role='menuitem'
                        :tabindex='compact ? undefined : 0'
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='router.push("/menu/overlays")'
                        @keyup.enter='router.push("/menu/overlays")'
                    >
                        <IconBoxMultiple
                            v-tooltip='{
                                content: "Overlays",
                                placement: "left",
                            }'
                            :tabindex='compact ? 0 : undefined'
                            title='Open Overlays Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2 user-select-none'
                            style='font-size: 18px;'
                        >Overlays</span>
                    </div>
                    <div
                        role='menuitem'
                        :tabindex='compact ? undefined : 0'
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='router.push("/menu/contacts")'
                        @keyup.enter='router.push("/menu/contacts")'
                    >
                        <IconUsers
                            v-tooltip='{
                                content: "Contacts",
                                placement: "left",
                            }'
                            :tabindex='compact ? 0 : undefined'
                            title='Open Contacts Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2 user-select-none'
                            style='font-size: 18px;'
                        >Contacts</span>
                    </div>
                    <div
                        role='menuitem'
                        :tabindex='compact ? undefined : 0'
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='router.push("/menu/basemaps")'
                        @keyup.enter='router.push("/menu/basemaps")'
                    >
                        <IconMap
                            v-tooltip='{
                                content: "Basemaps",
                                placement: "left",
                            }'
                            :tabindex='compact ? 0 : undefined'
                            title='Open Basemaps Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2 user-select-none'
                            style='font-size: 18px;'
                        >BaseMaps</span>
                    </div>
                    <div
                        role='menuitem'
                        :tabindex='compact ? undefined : 0'
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='router.push("/menu/missions")'
                        @keyup.enter='router.push("/menu/missions")'
                    >
                        <IconAmbulance
                            v-tooltip='{
                                content: "Data Sync",
                                placement: "left",
                            }'
                            :tabindex='compact ? 0 : undefined'
                            title='Open Data Syncs Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2 user-select-none'
                            style='font-size: 18px;'
                        >Data Sync</span>
                    </div>
                    <div
                        role='menuitem'
                        :tabindex='compact ? undefined : 0'
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='router.push("/menu/packages")'
                        @keyup.enter='router.push("/menu/packages")'
                    >
                        <IconPackages
                            v-tooltip='{
                                content: "Data Packages",
                                placement: "left",
                            }'
                            :tabindex='compact ? 0 : undefined'
                            title='Open Data Packages Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2 user-select-none'
                            style='font-size: 18px;'
                        >Data Package</span>
                    </div>
                    <div
                        role='menuitem'
                        :tabindex='compact ? undefined : 0'
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='router.push("/menu/channels")'
                        @keyup.enter='router.push("/menu/channels")'
                    >
                        <IconAffiliate
                            v-tooltip='{
                                content: "Channels",
                                placement: "left",
                            }'
                            :tabindex='compact ? 0 : undefined'
                            title='Open Channels Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2 user-select-none'
                            style='font-size: 18px;'
                        >Channels</span>
                    </div>
                    <div
                        role='menuitem'
                        :tabindex='compact ? undefined : 0'
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='router.push("/menu/videos")'
                        @keyup.enter='router.push("/menu/videos")'
                    >
                        <IconVideo
                            v-tooltip='{
                                content: "Videos",
                                placement: "left",
                            }'
                            :tabindex='compact ? 0 : undefined'
                            title='Open Videos Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2 user-select-none'
                            style='font-size: 18px;'
                        >Videos</span>
                    </div>
                    <div
                        role='menuitem'
                        :tabindex='compact ? undefined : 0'
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='router.push("/menu/chats")'
                        @keyup.enter='router.push("/menu/chats")'
                    >
                        <IconMessage
                            v-tooltip='{
                                content: "Chats",
                                placement: "left",
                            }'
                            :tabindex='compact ? 0 : undefined'
                            title='Open Chats Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2 user-select-none'
                            style='font-size: 18px;'
                        >Chats</span>
                    </div>
                    <div
                        role='menuitem'
                        :tabindex='compact ? undefined : 0'
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='router.push("/menu/routes")'
                        @keyup.enter='router.push("/menu/routes")'
                    >
                        <IconRoute
                            v-tooltip='{
                                content: "Routes",
                                placement: "left",
                            }'
                            :tabindex='compact ? 0 : undefined'
                            title='Open Routes Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2 user-select-none'
                            style='font-size: 18px;'
                        >Routes</span>
                    </div>
                    <div
                        role='menuitem'
                        :tabindex='compact ? undefined : 0'
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='router.push("/menu/files")'
                        @keyup.enter='router.push("/menu/files")'
                    >
                        <IconFiles
                            v-tooltip='{
                                content: "Your Files",
                                placement: "left",
                            }'
                            :tabindex='compact ? 0 : undefined'
                            title='Open Files Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2 user-select-none'
                            style='font-size: 18px;'
                        >Uploaded Files</span>
                    </div>
                    <div
                        role='menuitem'
                        :tabindex='compact ? undefined : 0'
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='router.push("/menu/imports")'
                        @keyup.enter='router.push("/menu/imports")'
                    >
                        <IconFileImport
                            v-tooltip='{
                                content: "Imports",
                                placement: "left",
                            }'
                            :tabindex='compact ? 0 : undefined'
                            title='Open Imports Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2 user-select-none'
                            style='font-size: 18px;'
                        >Imports</span>
                    </div>
                    <div
                        role='menuitem'
                        :tabindex='compact ? undefined : 0'
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='router.push("/menu/iconsets")'
                        @keyup.enter='router.push("/menu/iconsets")'
                    >
                        <IconPhoto
                            v-tooltip='{
                                content: "Iconsets",
                                placement: "left",
                            }'
                            :tabindex='compact ? 0 : undefined'
                            title='Open Iconsets Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2 user-select-none'
                            style='font-size: 18px;'
                        >Iconsets</span>
                    </div>

                    <div
                        v-if='isAgencyAdmin || isSystemAdmin'
                        role='menuitem'
                        :tabindex='compact ? undefined : 0'
                        class='cursor-pointer col-12 d-flex align-items-center position-relative'
                        :class='{
                            "py-2 px-3 hover": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='router.push("/menu/connections")'
                        @keyup.enter='router.push("/menu/connections")'
                    >
                        <IconNetwork
                            v-tooltip='{
                                content: "Connections (Admin)",
                                placement: "left",
                            }'
                            :tabindex='compact ? 0 : undefined'
                            title='Open Connections Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            stroke='1'
                        />
                        <span
                            v-if='compact'
                            class='position-absolute badge bg-blue text-white'
                            style='top: 5px; right: 5px; font-size: 10px; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; border-radius: 50%;'
                        >A</span>
                        <span
                            v-if='!compact'
                            class='mx-2 user-select-none'
                            style='font-size: 18px;'
                        >Connections</span>
                        <span
                            v-if='!compact'
                            class='ms-auto badge border border-blue bg-blue text-white'
                        >
                            Admin
                        </span>
                    </div>
                    <div
                        v-if='isSystemAdmin'
                        role='menuitem'
                        :tabindex='compact ? undefined : 0'
                        class='cursor-pointer col-12 d-flex align-items-center position-relative'
                        :class='{
                            "py-2 px-3 hover": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='router.push("/menu/debugger")'
                        @keyup.enter='router.push("/menu/debugger")'
                    >
                        <IconBug
                            v-tooltip='{
                                content: "Debugger (Admin)",
                                placement: "left",
                            }'
                            :tabindex='compact ? 0 : undefined'
                            title='COT Debugger'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            stroke='1'
                        />
                        <span
                            v-if='compact'
                            class='position-absolute badge bg-blue text-white'
                            style='top: 5px; right: 5px; font-size: 10px; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; border-radius: 50%;'
                        >A</span>
                        <span
                            v-if='!compact'
                            class='mx-2 user-select-none'
                            style='font-size: 18px;'
                        >COT Debugger</span>
                        <span
                            v-if='!compact'
                            class='ms-auto badge border border-blue bg-blue text-white'
                        >
                            Admin
                        </span>
                    </div>
                    <div
                        v-if='isSystemAdmin'
                        role='menuitem'
                        :tabindex='compact ? undefined : 0'
                        class='cursor-pointer col-12 d-flex align-items-center position-relative'
                        :class='{
                            "py-2 px-3 hover": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='router.push("/admin")'
                        @keyup.enter='router.push("/admin")'
                    >
                        <IconServerCog
                            v-tooltip='{
                                content: "Server Settings (Admin)",
                                placement: "left",
                            }'
                            :tabindex='compact ? 0 : undefined'
                            title='Open Server Admin Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            stroke='1'
                        />
                        <span
                            v-if='compact'
                            class='position-absolute badge bg-blue text-white'
                            style='top: 5px; right: 5px; font-size: 10px; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; border-radius: 50%;'
                        >A</span>
                        <span
                            v-if='!compact'
                            class='mx-2 user-select-none'
                            style='font-size: 18px;'
                        >Server</span>
                        <span
                            v-if='!compact'
                            class='ms-auto badge border border-blue bg-blue text-white'
                        >
                            Admin
                        </span>
                    </div>
                    <div
                        role='menuitem'
                        :tabindex='compact ? undefined : 0'
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='router.push("/menu/settings")'
                        @keyup.enter='router.push("/menu/settings")'
                    >
                        <IconSettings
                            v-tooltip='{
                                content: "Display Settings",
                                placement: "left",
                            }'
                            :tabindex='compact ? 0 : undefined'
                            title='Open Settings Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2 user-select-none'
                            style='font-size: 18px;'
                        >Settings</span>
                    </div>
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
import { ref, watch, useTemplateRef, onMounted } from 'vue';
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
} from '@tabler/icons-vue';
import {
    TablerDropdown,
    TablerIconButton
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

defineProps({
    compact: Boolean,
})

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

</style>
