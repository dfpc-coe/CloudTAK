<template>
<div
    data-bs-theme="dark"
    class='position-absolute end-0 bottom-0 text-white bg-dark overflow-auto'
    style='z-index: 1; width: 400px; top: 56px;'
>
    <template v-if='mode === "settings"'>
        <MenuSettings
            @close='mode = null'
        />
    </template>
    <template v-else-if='mode === "missions"'>
        <MenuMissions
            @close='mode = null'
        />
    </template>
    <template v-else-if='mode && mode.startsWith("chat:")'>
        <MenuChat
            :uid='mode.split(":")[1]'
            @close='mode = null'
        />
    </template>
    <template v-else-if='mode === "channels"'>
        <MenuChannels
            @close='mode = null'
            @reset='$emit("reset")'
        />
    </template>
    <template v-else-if='mode === "contacts"'>
        <MenuContacts
            @close='mode = null'
            @chat='mode = `chat:${$event}`'
        />
    </template>
    <template v-else-if='mode === "datas"'>
        <MenuDatas
            @close='mode = null'
            @mode='mode = $event'
        />
    </template>
    <template v-else-if='mode === "chats"'>
        <MenuChats
            @close='mode = null'
            @mode='mode = $event'
        />
    </template>
    <template v-else-if='mode === "overlays"'>
        <MenuOverlays
            @close='mode = null'
            @datas='mode = "datas"'
        />
    </template>
    <template v-else-if='mode === "basemaps"'>
        <MenuBasemaps
            @close='mode = null'
        />
    </template>
    <template v-else>
        <div class='row'>
            <div class='col-12 border-bottom border-light'>
                <div class='modal-header px-0 mx-2 align-center'>
                    <div/>
                    <div class='modal-title'>Sidebar</div>
                    <div/>
                </div>
            </div>
            <div class='row py-2 px-2'>
                <div @click='mode = "settings"' class='cursor-pointer col-12 py-2 px-2 d-flex align-items-center hover-dark'>
                    <IconSettings size='32'/>
                    <span class='mx-2' style='font-size: 18px;'>Settings</span>
                </div>
                <div @click='mode = "overlays"' class='cursor-pointer col-12 py-2 px-2 d-flex align-items-center hover-dark'>
                    <IconBoxMultiple size='32'/>
                    <span class='mx-2' style='font-size: 18px;'>Overlays</span>
                </div>
                <div @click='mode = "contacts"' class='cursor-pointer col-12 py-2 px-2 d-flex align-items-center hover-dark'>
                    <IconUsers size='32'/>
                    <span class='mx-2' style='font-size: 18px;'>Contacts</span>
                </div>
                <div @click='mode = "basemaps"' class='cursor-pointer col-12 py-2 px-2 d-flex align-items-center hover-dark'>
                    <IconMap size='32'/>
                    <span class='mx-2' style='font-size: 18px;'>BaseMaps</span>
                </div>
                <div @click='mode = "missions"' class='cursor-pointer col-12 py-2 px-2 d-flex align-items-center hover-dark'>
                    <IconAmbulance size='32'/>
                    <span class='mx-2' style='font-size: 18px;'>Mission Sync</span>
                </div>
                <div @click='mode = "channels"' class='cursor-pointer col-12 py-2 px-2 d-flex align-items-center hover-dark'>
                    <IconAffiliate size='32'/>
                    <span class='mx-2' style='font-size: 18px;'>Channels</span>
                </div>
            </div>
        </div>
    </template>
</div>
</template>

<script>
import {
    IconMap,
    IconUsers,
    IconSettings,
    IconAmbulance,
    IconBoxMultiple,
    IconAffiliate,
} from '@tabler/icons-vue';
import MenuBasemaps from './Menu/Basemaps.vue';
import MenuOverlays from './Menu/Overlays.vue';
import MenuDatas from './Menu/Datas.vue';
import MenuChats from './Menu/Chats.vue';
import MenuChat from './Menu/Chat.vue';
import MenuContacts from './Menu/Contacts.vue';
import MenuSettings from './Menu/Settings.vue';
import MenuMissions from './Menu/Missions.vue';
import MenuChannels from './Menu/Channels.vue';

export default {
    name: 'CloudTAKMenu',
    data: function() {
        return {
            mode: null
        }
    },
    components: {
        IconBoxMultiple,
        MenuBasemaps,
        MenuSettings,
        MenuOverlays,
        MenuContacts,
        MenuChannels,
        MenuMissions,
        MenuChats,
        MenuChat,
        MenuDatas,
        IconAffiliate,
        IconAmbulance,
        IconSettings,
        IconUsers,
        IconMap
    }
}
</script>
