<template>
<div>
    <template v-if='isEditing && isEditing.single'>
        <div class='col-12 border-bottom border-light'>
            <div class='modal-header px-0 mx-2'>
                <IconCircleArrowLeft @click='isEditing.single = false' class='cursor-pointer'/>

                <div class='modal-title'>
                    <IconPaintFilled v-if='isEditing.single.type === "fill"'/>
                    <span v-text='isEditing.single.id'/>
                </div>
                <div class='btn-list'></div>
            </div>
        </div>
        <div class="col-lg py-2 px-3">
            <label class='subheader pb-2'>Filter</label>
            <div class='col-12 bg-gray-500 px-2 my-2 py-2'>
                <span v-text='isEditing.single.filter'/>
            </div>
        </div>
        <div class="col-lg py-2 px-3">
            <label class='subheader pb-2'>Source Layer</label>
            <div class='col-12 bg-gray-500 px-2 my-2 py-2'>
                <span v-text='isEditing.single["source-layer"]'/>
            </div>
        </div>
        <div class="col-lg py-2 px-3">
            <label class='subheader'>Layout</label>
            <div v-if='Object.keys(isEditing.single.layout).length === 0' class='col-12 d-flex bg-gray-500 px-2 my-2 py-2'>
                None
            </div>
            <div :key='p' v-for='p of Object.keys(isEditing.single.layout)' class='col-12 d-flex bg-gray-500 px-2 my-2 py-2'>
                <span v-text='p'/>

                <span class='ms-auto' v-text='isEditing.single.layout[p]'/>
            </div>
        </div>
        <div class="col-lg py-2 px-3">
            <label class='subheader'>Paint</label>
            <div v-if='Object.keys(isEditing.single.paint).length === 0' class='col-12 d-flex bg-gray-500 px-2 my-2 py-2'>
                None
            </div>
            <div :key='p' v-for='p of Object.keys(isEditing.single.paint)' class='col-12 d-flex bg-gray-500 px-2 my-2 py-2'>
                <template v-if='["fill-opacity", "line-opacity"].includes(p)'>
                    <TablerRange label='Opacity' v-model='isEditing.single.paint[p]' :min='0' :max='1' :step='0.1'>
                        <span class='float-right' v-text='Math.round(isEditing.single.paint[p] * 100) + "%"'/>
                    </TablerRange>
                </template>
                <template v-else-if='["line-width"].includes(p)'>
                    <TablerRange label='Width' v-model='isEditing.single.paint[p]' :min='1' :max='10' :step='1'>
                        <span class='float-right' v-text='isEditing.single.paint[p]'/>
                    </TablerRange>
                </template>
                <template v-else-if='["fill-color", "line-color"].includes(p)'>
                    <TablerColour label='Colour' v-model='isEditing.single.paint[p]' :min='0' :max='1' :step='0.1'/>
                </template>
                <template v-else>
                    <span v-text='p'/>
                    <span class='ms-auto' v-text='isEditing.single.paint[p]'/>
                </template>
            </div>
        </div>
    </template>
    <template v-else-if='isEditing'>
        <div class='col-12 border-bottom border-light'>
            <div class='modal-header px-0 mx-2'>
                <IconCircleArrowLeft @click='isEditing = false' class='cursor-pointer'/>
                <div class='modal-title' v-text='isEditing.layer.name'></div>
                <div class='btn-list'></div>
            </div>
        </div>
        <div :key='l' v-for='l of isEditing.layer.layers' class="col-lg py-2 px-3 hover-dark">
            <div class='py-2 px-2 hover-dark cursor-pointer'>
                <div @click='isEditing.single = l' class='user-select-none' v-text='l.id'/>
            </div>
        </div>
    </template>
    <template v-else>
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
            <div :key='layer.url' v-for='layer in layers' class="col-lg py-2 px-3 hover-dark">
                <div @click='editor(layer)' class='py-2 px-2 hover-dark' :class='{
                    "cursor-pointer": ["data", "profile"].includes(layer.mode) && layer.type === "vector"
                }'>
                    <div class='col-12 d-flex align-items-center'>
                        <IconEye v-if='layer.visible === "visible"' @click='flipVisible(layer)' class='cursor-pointer' v-tooltip='"Hide Layer"'/>
                        <IconEyeOff v-else @click='flipVisible(layer)' class='cursor-pointer' v-tooltip='"Show Layer"'/>

                        <span class='mx-2'>
                            <IconMap v-if='layer.type === "raster"' v-tooltip='"Raster"'/>
                            <IconVector v-else v-tooltip='"Vector"'/>
                        </span>

                        <span class='mx-2 user-select-none' v-text='layer.name'/>

                        <div class='ms-auto btn-list'>
                            <IconMaximize v-if='getSource(layer).bounds' @click='zoomTo(getSource(layer).bounds)' class='cursor-pointer' v-tooltip='"Zoom To Overlay"'/>
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
import {
    TablerDelete,
    TablerLoading,
    TablerInput,
    TablerColour,
    TablerRange
} from '@tak-ps/vue-tabler';
import {
    IconCircleArrowLeft,
    IconPaintFilled,
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
            isEditing: false,
            loading: false,
        }
    },
    computed: {
        ...mapState(useMapStore, ['layers'])
    },
    watch: {
        isEditing: {
            deep: true,
            handler: function() {
                if (!this.isEditing || !this.isEditing.single) return;

                for (const paint of ['fill-opacity', 'fill-color', 'line-opacity', 'line-color', 'line-width']) {
                    if (this.isEditing.single.paint[paint]) {
                        mapStore.map.setPaintProperty(this.isEditing.single.id, paint, this.isEditing.single.paint[paint]);
                    }
                }
            }
        }
    },
    methods: {
        removeLayer: async function(layer) {
            this.loading = true;
            mapStore.removeLayer(layer.name);
            this.loading = false;
        },
        editor: function(layer) {
            if (["data", "profile"].includes(layer.mode) && layer.type === "vector") {
                this.isEditing = {
                    layer: layer,
                    single: false
                }
            }
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
        TablerColour,
        TablerInput,
        TablerLoading,
        TablerDelete,
        IconMaximize,
        IconCircleArrowLeft,
        IconEye,
        IconPaintFilled,
        IconEyeOff,
        IconPlus,
        IconVector,
        IconMap
    }
}
</script>
