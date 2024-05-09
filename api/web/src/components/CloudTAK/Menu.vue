<template>
<div
    class='position-absolute end-0 bottom-0 text-white bg-dark'
    style='z-index: 1; width: 400px; top: 56px;'
>
    <div class='position-relative h-100 container px-0'>
        <router-view
            v-if='$route.name !== "home-menu"'
            @reset='$emit("reset")'
        />
        <template v-else>
            <div class='sticky-top col-12 border-bottom border-light bg-dark'>
                <div class='modal-header px-0 mx-2 align-center'>
                    <div class='modal-title'></div>
                    <div class='modal-title'>Sidebar</div>
                    <div class='modal-title'></div>
                </div>
            </div>
            <div class='col-12 overflow-auto' style='height: calc(100% - 106px)'>
                <div @click='$router.push("/menu/settings")' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                    <IconSettings size='32'/>
                    <span class='mx-2' style='font-size: 18px;'>Settings</span>
                </div>
                <div @click='$router.push("/menu/overlays")' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                    <IconBoxMultiple size='32'/>
                    <span class='mx-2' style='font-size: 18px;'>Overlays</span>
                </div>
                <div @click='$router.push("/menu/contacts")' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                    <IconUsers size='32'/>
                    <span class='mx-2' style='font-size: 18px;'>Contacts</span>
                </div>
                <div @click='$router.push("/menu/basemaps")' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                    <IconMap size='32'/>
                    <span class='mx-2' style='font-size: 18px;'>BaseMaps</span>
                </div>
                <div @click='$router.push("/menu/missions")' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                    <IconAmbulance size='32'/>
                    <span class='mx-2' style='font-size: 18px;'>Mission Sync</span>
                </div>
                <div @click='$router.push("/menu/packages")' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                    <IconPackages size='32'/>
                    <span class='mx-2' style='font-size: 18px;'>Data Package</span>
                </div>
                <div @click='$router.push("/menu/channels")' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                    <IconAffiliate size='32'/>
                    <span class='mx-2' style='font-size: 18px;'>Channels</span>
                </div>
                <div @click='$router.push("/menu/videos")' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                    <IconVideo size='32'/>
                    <span class='mx-2' style='font-size: 18px;'>Videos</span>
                </div>
                <div @click='$router.push("/menu/chats")' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                    <IconMessage size='32'/>
                    <span class='mx-2' style='font-size: 18px;'>Chats</span>
                </div>
                <div @click='$router.push("/menu/imports")' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                    <IconFileImport size='32'/>
                    <span class='mx-2' style='font-size: 18px;'>Imports</span>
                </div>
                <div @click='$router.push("/menu/iconsets")' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                    <IconPhoto size='32'/>
                    <span class="mx-2" style='font-size: 18px;'>Iconsets</span>
                </div>

                <div v-if='profile.system_admin || profile.agency_admin.length' @click='$router.push("/connection")' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                    <IconNetwork size='32'/>
                    <span class="mx-2" style='font-size: 18px;'>Connections</span>
                    <span class='ms-auto badge border border-red bg-red text-white'>Admin</span>
                </div>
                <div v-if='profile.system_admin' @click='$router.push("/admin")' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                    <IconSettings size='32'/>
                    <span class='mx-2' style='font-size: 18px;'>Server</span>
                    <span class='ms-auto badge border border-red bg-red text-white'>Admin</span>
                </div>
            </div>
        </template>

        <div v-if='$route.name === "home-menu"' class='position-absolute bottom-0 start-0 end-0 border-top border-white bg-dark'>
            <div class='row g-0 align-items-center'>
                <div @click='$router.push("/profile")' style='width: calc(100% - 40px)' class='py-2 d-flex align-items-center hover-dark cursor-pointer'>
                    <div class='d-flex align-items-center'>
                        <IconUser size='32' class='mx-2'/>
                        <span style='font-size: 18px;' v-text='profile.username'></span>
                    </div>
                </div>

                <div @click.stop.prevent='logout' style='width: 40px;' class='py-2 px-2 ms-auto d-flex hover-dark cursor-pointer'>
                    <IconLogout v-tooltip='"Logout"' size='32'/>
                </div>
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
    IconAffiliate,
} from '@tabler/icons-vue';
import { mapState } from 'pinia'
import { useProfileStore } from '/src/stores/profile.ts';

export default {
    name: 'CloudTAKMenu',
    computed: {
        ...mapState(useProfileStore, ['profile']),
    },
    methods: {
        logout: function() {
            this.user = null;
            delete localStorage.token;
            this.$router.push("/login");
        },
    },
    components: {
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
