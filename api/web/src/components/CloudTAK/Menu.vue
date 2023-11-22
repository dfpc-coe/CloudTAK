<template>
<div class='position-absolute end-0 bottom-0 text-white py-2 bg-dark' style='z-index: 1; width: 400px; top: 50px;'>
    <template v-if='mode === "settings"'>
    </template>
    <template v-else-if='mode === "contacts"'>
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
    SettingsIcon
} from 'vue-tabler-icons';
import MenuBasemaps from './Menu/Basemaps.vue';

export default {
    name: 'CloudTAKMenu',
    data: function() {
        return {
            mode: null
        }
    },
    components: {
        MenuBasemaps,
        SettingsIcon,
        UsersIcon,
        MapIcon
    }
}
</script>
