<template>
<div
    class='position-absolute end-0 bottom-0 text-white bg-dark overflow-auto'
    style='z-index: 1; width: 400px; top: 56px;'
>
    <div class='position-relative h-100'>
        <router-view
            v-if='$route.name !== "menu"'
            @reset='$emit("reset")'
        />
        <template v-else>
            <div class='col-12 border-bottom border-light'>
                <div class='modal-header px-0 mx-2 align-center'>
                    <div/>
                    <div class='modal-title'>Sidebar</div>
                    <div/>
                </div>
            </div>
            <div @click='$router.push("/profile")' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                <IconUser size='32'/>
                <span class='mx-2' style='font-size: 18px;'>Profile</span>
            </div>
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
            <div @click='$router.push("/menu/channels")' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                <IconAffiliate size='32'/>
                <span class='mx-2' style='font-size: 18px;'>Channels</span>
            </div>
            <div @click='$router.push("/menu/chats")' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                <IconMessage size='32'/>
                <span class='mx-2' style='font-size: 18px;'>Chats</span>
            </div>
            <div @click='$router.push("/menu/imports")' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                <IconFileImport size='32'/>
                <span class='mx-2' style='font-size: 18px;'>Imports</span>
            </div>

            <div v-if='profile.system_admin || profile.agency_admin' @click='$router.push("/connection")' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                <IconNetwork size='32'/>
                <span class="mx-2">Connections</span>
                <span class='ms-auto badge border border-red bg-red text-white'>Admin</span>
            </div>
            <div @click='$router.push("/iconset")' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                <IconPhoto size='32'/>
                <span class="mx-2">Iconsets</span>
            </div>
            <div @click='$router.push("/admin")' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                <IconSettings size='32'/>
                <span class='mx-2'>Server</span>
                <span class='ms-auto badge border border-red bg-red text-white'>Admin</span>
            </div>
            <div @click='logout' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                <IconLogout size='32'/>
                <span class="mx-2">Logout</span>
            </div>
        </template>
    </div>
</div>
</template>

<script>
import {
    IconMap,
    IconUser,
    IconUsers,
    IconMessage,
    IconNetwork,
    IconSettings,
    IconAmbulance,
    IconBoxMultiple,
    IconFileImport,
    IconAffiliate,
} from '@tabler/icons-vue';
import MenuImports from './Menu/Imports.vue';
import MenuBasemaps from './Menu/Basemaps.vue';
import MenuOverlays from './Menu/Overlays.vue';
import MenuDatas from './Menu/Datas.vue';
import MenuChats from './Menu/Chats.vue';
import MenuChat from './Menu/Chat.vue';
import MenuContacts from './Menu/Contacts.vue';
import MenuSettings from './Menu/Settings.vue';
import MenuMissions from './Menu/Missions.vue';
import MenuChannels from './Menu/Channels.vue';
import { mapState } from 'pinia'
import { useProfileStore } from '/src/stores/profile.js';
const profileStore = useProfileStore();

export default {
    name: 'CloudTAKMenu',
    computed: {
        ...mapState(useProfileStore, ['profile']),
    },
    components: {
        IconBoxMultiple,
        MenuBasemaps,
        MenuSettings,
        MenuOverlays,
        MenuContacts,
        MenuChannels,
        MenuMissions,
        MenuImports,
        MenuChats,
        MenuChat,
        MenuDatas,
        IconMessage,
        IconNetwork,
        IconAffiliate,
        IconAmbulance,
        IconSettings,
        IconFileImport,
        IconUser,
        IconUsers,
        IconMap
    }
}
</script>
