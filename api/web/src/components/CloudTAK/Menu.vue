<template>
    <div
        class='position-absolute end-0 bottom-0 text-white'
        :class='{
            "bg-dark": !compact
        }'
        style='z-index: 1; top: 56px;'
        :style='`
            width: ${compact ? "60px" : "400px"};
            ${compact ? "background-color: rgb(0, 0, 0, 0.5)" : ""}
        `'
    >
        <div class='position-relative h-100 container px-0'>
            <router-view
                v-if='!["home", "home-menu"].includes($route.name)'
            />
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
                            Sidebar
                        </div>
                        <div />
                    </div>
                </div>
                <div
                    class='col-12 overflow-auto'
                    style='height: calc(100% - 106px)'
                >
                    <div
                        role='button'
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover-dark": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='push("/menu/settings")'
                    >
                        <IconSettings
                            v-tooltip='{
                                content: "Display Settings",
                                placement: "left",
                            }'
                            title='Open Settings Panel'
                            :class='{ "mx-2": compact }'
                            :size='compact ? 40 : 32'
                            :stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2'
                            style='font-size: 18px;'
                        >Settings</span>
                    </div>
                    <div
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover-dark": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='push("/menu/overlays")'
                    >
                        <IconBoxMultiple
                            v-tooltip='{
                                content: "Overlays",
                                placement: "left",
                            }'
                            title='Open Overlays Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            :stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2'
                            style='font-size: 18px;'
                        >Overlays</span>
                    </div>
                    <div
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover-dark": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='push("/menu/contacts")'
                    >
                        <IconUsers
                            v-tooltip='{
                                content: "Contacts",
                                placement: "left",
                            }'
                            title='Open Contacts Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            :stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2'
                            style='font-size: 18px;'
                        >Contacts</span>
                    </div>
                    <div
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover-dark": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='push("/menu/basemaps")'
                    >
                        <IconMap
                            v-tooltip='{
                                content: "Basemaps",
                                placement: "left",
                            }'
                            title='Open Basemaps Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            :stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2'
                            style='font-size: 18px;'
                        >BaseMaps</span>
                    </div>
                    <div
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover-dark": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='push("/menu/missions")'
                    >
                        <IconAmbulance
                            v-tooltip='{
                                content: "Data Sync",
                                placement: "left",
                            }'
                            title='Open Data Syncs Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            :stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2'
                            style='font-size: 18px;'
                        >Data Sync</span>
                    </div>
                    <div
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover-dark": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='push("/menu/packages")'
                    >
                        <IconPackages
                            v-tooltip='{
                                content: "Data Packages",
                                placement: "left",
                            }'
                            title='Open Data Packages Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            :stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2'
                            style='font-size: 18px;'
                        >Data Package</span>
                    </div>
                    <div
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover-dark": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='push("/menu/channels")'
                    >
                        <IconAffiliate
                            v-tooltip='{
                                content: "Channels",
                                placement: "left",
                            }'
                            title='Open Channels Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            :stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2'
                            style='font-size: 18px;'
                        >Channels</span>
                    </div>
                    <div
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover-dark": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='push("/menu/videos")'
                    >
                        <IconVideo
                            v-tooltip='{
                                content: "Videos",
                                placement: "left",
                            }'
                            title='Open Videos Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            :stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2'
                            style='font-size: 18px;'
                        >Videos</span>
                    </div>
                    <div
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover-dark": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='push("/menu/chats")'
                    >
                        <IconMessage
                            v-tooltip='{
                                content: "Chats",
                                placement: "left",
                            }'
                            title='Open Chats Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            :stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2'
                            style='font-size: 18px;'
                        >Chats</span>
                    </div>
                    <div
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover-dark": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='push("/menu/files")'
                    >
                        <IconFiles
                            v-tooltip='{
                                content: "Your Files",
                                placement: "left",
                            }'
                            title='Open Files Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            :stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2'
                            style='font-size: 18px;'
                        >Uploaded Files</span>
                    </div>
                    <div
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover-dark": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='push("/menu/imports")'
                    >
                        <IconFileImport
                            v-tooltip='{
                                content: "Imports",
                                placement: "left",
                            }'
                            title='Open Imports Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            :stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2'
                            style='font-size: 18px;'
                        >Imports</span>
                    </div>
                    <div
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover-dark": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='push("/menu/iconsets")'
                    >
                        <IconPhoto
                            v-tooltip='{
                                content: "Iconsets",
                                placement: "left",
                            }'
                            title='Open Iconsets Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            :stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2'
                            style='font-size: 18px;'
                        >Iconsets</span>
                    </div>

                    <div
                        v-if='profile.system_admin || profile.agency_admin.length'
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover-dark": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='push("/menu/connections")'
                    >
                        <IconNetwork
                            v-tooltip='{
                                content: "Connections",
                                placement: "left",
                            }'
                            title='Open Connections Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            :stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2'
                            style='font-size: 18px;'
                        >Connections</span>
                        <span
                            v-if='!compact'
                            class='ms-auto badge border border-red bg-red text-white'
                        >
                            Admin
                        </span>
                    </div>
                    <div
                        v-if='profile.system_admin'
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover-dark": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='push("/admin")'
                    >
                        <IconServerCog
                            v-tooltip='{
                                content: "Server Settings",
                                placement: "left",
                            }'
                            title='Open Server Admin Panel'
                            :class='{ "mx-2": compact }'
                            :size='32'
                            :stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2'
                            style='font-size: 18px;'
                        >Server</span>
                        <span
                            v-if='!compact'
                            class='ms-auto badge border border-red bg-red text-white'
                        >
                            Admin
                        </span>
                    </div>
                </div>
            </template>

            <div
                class='position-absolute bottom-0 start-0 end-0'
                :class='{
                    "bg-dark border-top border-white": !compact && $route.name === "home-menu"
                }'
            >
                <div
                    v-if='$route.name === "home-menu" && !compact'
                    class='row g-0 align-items-center'
                >
                    <div
                        style='width: calc(100% - 40px)'
                        class='py-2 d-flex align-items-center hover-dark cursor-pointer'
                        role='button'
                        @click='$router.push("/profile")'
                    >
                        <div class='d-flex align-items-center'>
                            <IconUser
                                title='User Icon'
                                :size='32'
                                :stroke='1'
                                class='mx-2'
                            />
                            <span
                                style='font-size: 18px;'
                                v-text='profile.username'
                            />
                        </div>
                    </div>

                    <div
                        role='button'
                        style='width: 40px;'
                        class='py-2 px-2 ms-auto d-flex hover-dark cursor-pointer'
                        @click.stop.prevent='logout'
                    >
                        <IconLogout
                            v-tooltip='"Logout"'
                            title='Logout'
                            :size='32'
                            :stroke='1'
                        />
                    </div>
                </div>
                <div v-else-if='["home", "home-menu"].includes($route.name)'>
                    <Status
                        class='mx-2 my-2'
                        :status='open ? "success" : "fail"'
                        :dark='true'
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import {
    IconMap,
    IconUser,
    IconFiles,
    IconUsers,
    IconVideo,
    IconPhoto,
    IconLogout,
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
import Status from '../util/Status.vue';
import { mapState } from 'pinia'
import { useProfileStore } from '/src/stores/profile.ts';
import { useConnectionStore } from '/src/stores/connection.ts';

export default {
    name: 'CloudTAKMenu',
    computed: {
        ...mapState(useProfileStore, ['profile']),
        ...mapState(useConnectionStore, ['open']),
    },
    components: {
        Status,
        IconServerCog,
        IconBoxMultiple,
        IconPackages,
        IconPhoto,
        IconMessage,
        IconNetwork,
        IconAffiliate,
        IconAmbulance,
        IconSettings,
        IconFileImport,
        IconFiles,
        IconLogout,
        IconVideo,
        IconUser,
        IconUsers,
        IconMap
    },
    props: {
        compact: Boolean,
    },
    methods: {
        push: function(path) {
            this.$router.push(path);
        },
        logout: function() {
            this.user = null;
            delete localStorage.token;
            this.$router.push("/login");
        },
    }
}
</script>
