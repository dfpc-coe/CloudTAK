<template>
<div>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$emit("close")' class='cursor-pointer'/>
            <div class='modal-title'>Overlays</div>
            <div class='btn-list'>
                <IconPlus @click='$emit("datas")' class='cursor-pointer' v-tooltip='"Add Overlay"'/>
            </div>
        </div>
    </div>
    <TablerLoading v-if='loading'/>
    <template v-else>
        <div :key='layer.url' v-for='layer in layers' class="col-lg py-2 px2 hover-dark">
            <div class='py-2 px-2 hover-dark'>
                <div class='col-12 d-flex align-items-center'>
                    <IconEye v-if='layer.visible === "visible"' @click='flipVisible(layer)' class='cursor-pointer' v-tooltip='"Hide Layer"'/>
                    <IconEyeOff v-else @click='flipVisible(layer)' class='cursor-pointer' v-tooltip='"Show Layer"'/>

                    <span class='mx-2'>
                        <IconMap v-if='layer.type === "raster"' v-tooltip='"Raster"'/>
                        <IconVector v-else v-tooltip='"Vector"'/>
                    </span>

                    <span class='mx-2' v-text='layer.name'/>

                    <div class='ms-auto btn-list'>
                        <IconMaximize v-if='getSource(layer).bounds' @click='zoomTo(getSource(layer).bounds)' class='cursor-pointer' v-tooltip='"Zoom To Overlay"'/>
                        <TablerDelete
                            :key='layer.id'
                            v-if='layer.name.startsWith("data-") || layer.name.startsWith("profile-")'
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
</div>
</template>

<script>
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
import { useMapStore } from '/src/stores/map.js';
import { mapState } from 'pinia'
const mapStore = useMapStore();

export default {
    name: 'Overlays',
    data: function() {
        return {
            err: false,
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
        getSource: function(layer) {
            return mapStore.map.getSource(layer.source)
        },
        flipVisible: async function(layer) {
            if (layer.visible === 'visible') {
                layer.visible = 'none';
                mapStore.updateLayer(layer)
            } else {
                layer.visible = 'visible';
                mapStore.updateLayer(layer)
            }
        },
        zoomTo: function(bounds) {
            mapStore.map.fitBounds(bounds);
        },
        updateOpacity: function(layer) {
            mapStore.updateLayer(layer)
        },
    },
    components: {
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
