<template>
<div>
    <OverlayLayers v-if='isEditing' :overlay='isEditing' @close='isEditing = false'/>

    <MenuTemplate v-else name='Overlays'>
        <template #buttons>
            <IconPlus @click='$router.push("/menu/datas")' class='cursor-pointer' size='32' v-tooltip='"Add Overlay"'/>
        </template>
        <template #default>
            <TablerLoading v-if='loading'/>
            <template v-else>
                <div :key='layer.url' v-for='layer in layers' class="col-lg py-2 px-3 hover-dark">
                    <div @click='editor(layer)' class='py-2 px-2 hover-dark' :class='{
                        "cursor-pointer": ["data", "profile"].includes(layer.mode) && layer.type === "vector"
                    }'>
                        <div class='col-12 d-flex align-items-center'>
                            <IconEye v-if='layer.visible === "visible"' @click.stop.prevent='flipVisible(layer)' size='32' class='cursor-pointer' v-tooltip='"Hide Layer"'/>
                            <IconEyeOff v-else @click.stop.prevent='flipVisible(layer)' size='32' class='cursor-pointer' v-tooltip='"Show Layer"'/>

                            <span class='mx-2'>
                                <IconMap v-if='layer.type === "raster"' v-tooltip='"Raster"' size='32'/>
                                <IconVector v-else v-tooltip='"Vector"' size='32'/>
                            </span>

                            <span class='mx-2 user-select-none' v-text='layer.name'/>

                            <div class='ms-auto btn-list'>
                                <IconMaximize v-if='getSource(layer).bounds' @click.stop.prevent='zoomTo(getSource(layer).bounds)' size='32' class='cursor-pointer' v-tooltip='"Zoom To Overlay"'/>
                                <TablerDelete
                                    :key='layer.id'
                                    v-if='layer.mode === "mission" || layer.name.startsWith("data-") || layer.name.startsWith("profile-")'
                                    displaytype='icon'
                                    @delete='removeLayer(layer)'
                                    v-tooltip='"Delete Overlay"'
                                />
                            </div>
                        </div>

                        <div v-if='layer.type === "raster"' class='col-12' style='margin-left: 30px; padding-right: 40px;' step=''>
                            <TablerRange label='Opacity' v-model='layer.opacity' @change='updateOpacity(layer)' :min='0' :max='1' :step='0.1'/>
                        </div>
                    </div>
                </div>
            </template>
        </template>
    </MenuTemplate>
</div>
</template>

<script>
import MenuTemplate from '../util/MenuTemplate.vue';
import OverlayLayers from './Overlays/Layers.vue';
import {
    TablerDelete,
    TablerLoading,
    TablerRange
} from '@tak-ps/vue-tabler';
import {
    IconMaximize,
    IconVector,
    IconEyeOff,
    IconPlus,
    IconEye,
    IconMap
} from '@tabler/icons-vue';
import { useMapStore } from '/src/stores/map.ts';
import { mapState } from 'pinia'
const mapStore = useMapStore();

export default {
    name: 'CloudTAKOverlays',
    data: function() {
        return {
            err: false,
            isEditing: false,
            loading: false,
        }
    },
    computed: {
        ...mapState(useMapStore, ['layers'])
    },
    methods: {
        removeLayer: async function(layer) {
            this.loading = true;
            mapStore.removeLayer(layer.name);
            this.loading = false;
        },
        editor: function(overlay) {
            if (["data", "profile"].includes(overlay.mode) && overlay.type === "vector") {
                this.isEditing = overlay;
            }
        },
        getSource: function(layer) {
            return mapStore.map.getSource(layer.source)
        },
        flipVisible: async function(layer) {
            if (layer.visible === 'visible') {
                layer.visible = 'none';
                await mapStore.updateLayer(layer)
            } else {
                layer.visible = 'visible';
                await mapStore.updateLayer(layer)
            }
        },
        zoomTo: function(bounds) {
            mapStore.map.fitBounds(bounds);
        },
        updateOpacity: async function(layer) {
            await mapStore.updateLayer(layer)
        },
    },
    components: {
        MenuTemplate,
        OverlayLayers,
        TablerRange,
        TablerLoading,
        TablerDelete,
        IconMaximize,
        IconEye,
        IconEyeOff,
        IconPlus,
        IconVector,
        IconMap
    }
}
</script>
