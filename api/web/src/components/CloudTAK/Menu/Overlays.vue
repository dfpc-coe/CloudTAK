<template>
<div>
    <OverlayLayers v-if='isEditing' :overlay='isEditing' @close='isEditing = false'/>
    <template v-else>
        <div class='col-12 border-bottom border-light'>
            <div class='modal-header px-0 mx-2'>
                <IconCircleArrowLeft @click='$router.back()' size='32' class='cursor-pointer'/>
                <div class='modal-title'>Overlays</div>
                <div class='btn-list'>
                    <IconPlus @click='$router.push("/menu/datas")' class='cursor-pointer' size='32' v-tooltip='"Add Overlay"'/>
                </div>
            </div>
        </div>
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
</div>
</template>

<script>
import OverlayLayers from './Overlays/Layers.vue';
import {
    TablerDelete,
    TablerLoading,
    TablerRange
} from '@tak-ps/vue-tabler';
import {
    IconCircleArrowLeft,
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
        OverlayLayers,
        TablerRange,
        TablerLoading,
        TablerDelete,
        IconMaximize,
        IconCircleArrowLeft,
        IconEye,
        IconEyeOff,
        IconPlus,
        IconVector,
        IconMap
    }
}
</script>
