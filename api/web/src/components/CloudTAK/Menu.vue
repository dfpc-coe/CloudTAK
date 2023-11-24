<template>
<div class='position-absolute end-0 bottom-0 text-white py-2 bg-dark' style='z-index: 1; width: 400px; top: 50px;'>
    <template v-if='mode === "settings"'>
    </template>
    <template v-else-if='mode === "contacts"'>
        <MenuContacts
            :map='map'
        />
    </template>
    <template v-else-if='mode === "datas"'>
        <MenuDatas
            :map='map'
        />
    </template>
    <template v-else-if='mode === "overlays"'>
        <MenuOverlays
            :map='map'
            @datas='mode = "datas"'
        />
    </template>
    <template v-else-if='mode === "basemaps"'>
        <MenuBasemaps
            @basemap='$emit("basemap", $event)'
        />
    </template>
    <template v-else>
        <div class='row'>
            <div @click='mode = "settings"' class='cursor-pointer col-12 py-2 px-2 d-flex align-items-center'>
                <SettingsIcon size='32'/>
                <span class='mx-2' style='font-size: 18px;'>Settings</span>
            </div>
            <div @click='mode = "overlays"' class='cursor-pointer col-12 py-2 px-2 d-flex align-items-center'>
                <BoxMultipleIcon size='32'/>
                <span class='mx-2' style='font-size: 18px;'>Overlays</span>
            </div>
            <div @click='mode = "contacts"' class='cursor-pointer col-12 py-2 px-2 d-flex align-items-center'>
                <UsersIcon size='32'/>
                <span class='mx-2' style='font-size: 18px;'>Contacts</span>
            </div>
            <div @click='mode = "basemaps"' class='cursor-pointer col-12 py-2 px-2 d-flex align-items-center'>
                <MapIcon size='32'/>
                <span class='mx-2' style='font-size: 18px;'>BaseMaps</span>
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
    BoxMultipleIcon,
} from 'vue-tabler-icons';
import MenuBasemaps from './Menu/Basemaps.vue';
import MenuOverlays from './Menu/Overlays.vue';
import MenuDatas from './Menu/Datas.vue';
import MenuContacts from './Menu/Contacts.vue';

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
        MenuOverlays,
        MenuContacts,
        MenuDatas,
        SettingsIcon,
        UsersIcon,
        MapIcon
    }
}
</script>
