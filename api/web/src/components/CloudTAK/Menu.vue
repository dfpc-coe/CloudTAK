<template>
<div class='position-absolute end-0 bottom-0 text-white bg-dark' style='z-index: 1; width: 400px; top: 50px;'>
    <template v-if='mode === "settings"'>
        <MenuSettings
            :map='map'
            @close='mode = null'
        />
    </template>
    <template v-else-if='mode === "missions"'>
        <MenuMissions
            @close='mode = null'
        />
    </template>
    <template v-else-if='mode === "contacts"'>
        <MenuContacts
            :map='map'
            @close='mode = null'
        />
    </template>
    <template v-else-if='mode === "datas"'>
        <MenuDatas
            :map='map'
            @close='mode = null'
        />
    </template>
    <template v-else-if='mode === "overlays"'>
        <MenuOverlays
            :map='map'
            @close='mode = null'
            @datas='mode = "datas"'
        />
    </template>
    <template v-else-if='mode === "basemaps"'>
        <MenuBasemaps
            @close='mode = null'
            @basemap='$emit("basemap", $event)'
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
                    <SettingsIcon size='32'/>
                    <span class='mx-2' style='font-size: 18px;'>Settings</span>
                </div>
                <div @click='mode = "overlays"' class='cursor-pointer col-12 py-2 px-2 d-flex align-items-center hover-dark'>
                    <BoxMultipleIcon size='32'/>
                    <span class='mx-2' style='font-size: 18px;'>Overlays</span>
                </div>
                <div @click='mode = "contacts"' class='cursor-pointer col-12 py-2 px-2 d-flex align-items-center hover-dark'>
                    <UsersIcon size='32'/>
                    <span class='mx-2' style='font-size: 18px;'>Contacts</span>
                </div>
                <div @click='mode = "basemaps"' class='cursor-pointer col-12 py-2 px-2 d-flex align-items-center hover-dark'>
                    <MapIcon size='32'/>
                    <span class='mx-2' style='font-size: 18px;'>BaseMaps</span>
                </div>
                <div @click='mode = "missions"' class='cursor-pointer col-12 py-2 px-2 d-flex align-items-center hover-dark'>
                    <AmbulanceIcon size='32'/>
                    <span class='mx-2' style='font-size: 18px;'>Mission Sync</span>
                </div>
            </div>
        </div>
    </template>
</div>
</template>

<script>
import {
    MapIcon,
    UsersIcon,
    SettingsIcon,
    AmbulanceIcon,
    BoxMultipleIcon,
} from 'vue-tabler-icons';
import MenuBasemaps from './Menu/Basemaps.vue';
import MenuOverlays from './Menu/Overlays.vue';
import MenuDatas from './Menu/Datas.vue';
import MenuContacts from './Menu/Contacts.vue';
import MenuSettings from './Menu/Settings.vue';
import MenuMissions from './Menu/Missions.vue';

export default {
    name: 'CloudTAKMenu',
    props: {
        map: {
            type: Object,
            required: true
        }
    },
    data: function() {
        return {
            mode: null
        }
    },
    components: {
        BoxMultipleIcon,
        MenuBasemaps,
        MenuSettings,
        MenuOverlays,
        MenuContacts,
        MenuMissions,
        MenuDatas,
        AmbulanceIcon,
        SettingsIcon,
        UsersIcon,
        MapIcon
    }
}
</script>
