<template>
    <div
        class='position-absolute end-0 bottom-0 text-white'
        :class='{
            "bg-dark": !compact
        }'
        style='z-index: 1; top: 56px;'
        :style='`
            width: ${compact ? "50px" : "400px"};
            ${compact ? "background-color: rgb(0, 0, 0, 0.5)" : ""}
        `'
    >
        <div class='position-relative h-100 container px-0'>
            <router-view
                v-if='$route.name !== "home-menu"'
                @reset='$emit("reset")'
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
                        <div>
                            <IconChevronRight
                                v-tooltip='"Pin to Edge"'
                                :size='40'
                                :stroke='1'
                                class='cursor-pointer'
                                @click='compact = true'
                            />
                        </div>
                    </div>
                </div>
                <div
                    class='col-12 overflow-auto'
                    style='height: calc(100% - 106px)'
                >
                    <div
                        class='cursor-pointer col-12 d-flex align-items-center'
                        :class='{
                            "py-2 px-3 hover-dark": !compact,
                            "py-1 px-2 hover-button": compact
                        }'
                        @click='push("/menu/settings")'
                    >
                        <IconSettings
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
                            v-if='!compact'
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
                            :size='32'
                            :stroke='1'
                        />
                        <span
                            v-if='!compact'
                            class='mx-2'
                            style='font-size: 18px;'
                        >Mission Sync</span>
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
                        @click='push("/menu/imports")'
                    >
                        <IconFileImport
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
                        @click='push("/connection")'
                    >
                        <IconNetwork
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
                        <IconSettings
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
                    "bg-dark border-top border-white": !compact
                }'
            >
                <div
                    v-if='$route.name === "home-menu" && !compact'
                    class='row g-0 align-items-center'
                >
                    <div
                        style='width: calc(100% - 40px)'
                        class='py-2 d-flex align-items-center hover-dark cursor-pointer'
                        @click='$router.go("/profile")'
                    >
                        <div class='d-flex align-items-center'>
                            <IconUser
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
                        style='width: 40px;'
                        class='py-2 px-2 ms-auto d-flex hover-dark cursor-pointer'
                        @click.stop.prevent='logout'
                    >
                        <IconLogout
                            v-tooltip='"Logout"'
                            :size='32'
                            :stroke='1'
                        />
                    </div>
                </div>
                <div v-else>
                    <Status
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
    IconUsers,
    IconVideo,
    IconPhoto,
    IconLogout,
    IconMessage,
    IconNetwork,
    IconPackages,
    IconSettings,
    IconAmbulance,
    IconBoxMultiple,
    IconFileImport,
    IconChevronRight,
    IconAffiliate,
} from '@tabler/icons-vue';
import Status from '../util/Status.vue';
import { mapState } from 'pinia'
import { useProfileStore } from '/src/stores/profile.ts';

export default {
    name: 'CloudTAKMenu',
    computed: {
        ...mapState(useProfileStore, ['profile']),
    },
    data: function() {
        return {
            compact: false
        }
    },
    methods: {
        push: function(path) {
            this.compact = false;
            this.$router.push(path);
        },
        logout: function() {
            this.user = null;
            delete localStorage.token;
            this.$router.push("/login");
        },
    },
    components: {
        Status,
        IconChevronRight,
        IconBoxMultiple,
        IconPackages,
        IconPhoto,
        IconMessage,
        IconNetwork,
        IconAffiliate,
        IconAmbulance,
        IconSettings,
        IconFileImport,
        IconLogout,
        IconVideo,
        IconUser,
        IconUsers,
        IconMap
    }
}
</script>
