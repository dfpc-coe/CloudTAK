<template>
<div class='row'>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$emit("close")' class='cursor-pointer'/>
            <div class='modal-title'>Overlays</div>
            <div class='btn-list'>
                <IconPlus @click='$emit("datas")' class='cursor-pointer'/>
            </div>
        </div>
    </div>
    <div :key='layer.name' v-for='layer in layers' class="col-lg-12">
        <div class='row col-12 py-2 px-2 d-flex'>
            <div class='col-12 d-flex align-items-center'>
                <IconEye v-if='layer.visible' @click='flipVisible(layer)' class='cursor-pointer' v-tooltip='"Hide Layer"'/>
                <IconEyeOff v-else @click='flipVisible(layer)' class='cursor-pointer' v-tooltip='"Show Layer"'/>

                <span class='mx-2'>
                    <IconMap v-if='layer.type === "raster"' v-tooltip='"Raster"'/>
                    <IconVector v-else v-tooltip='"Vector"'/>
                </span>
                <span class='mx-2' v-text='layer.name'/>

                <div class='ms-auto btn-list'>
                    <IconMaximize v-if='layer.bounds' @click='zoomTo(layer)' class='cursor-pointer' v-tooltip='"Zoom To Overlay"'/>
                    <TablerDelete v-if='layer.name.startsWith("data-")' displaytype='icon' @delete='removeLayer(layer)' v-tooltip='"Delete Overlay"' class='text-dark'/>
                </div>
            </div>

            <div v-if='layer.type === "raster"' class='col-12' style='margin-left: 30px; padding-right: 24px;' step=''>
                <TablerRange label='Opacity' v-model='layer.opacity' @change='updateOpacity(layer)' :min='0' :max='1' :step='0.1'/>
            </div>
        </div>
    </div>
</div>
</template>

<script>
import {
    TablerDelete,
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

export default {
    name: 'Overlays',
    props: {
        map: {
            type: Object,
            required: true
        }
    },
    data: function() {
        return {
            err: false,
            loading: true,
            layers: []
        }
    },
    mounted: async function() {
        await this.genList();
    },
    methods: {
        flipVisible: async function(layer) {
            if (layer.visible) {
                this.map.setLayoutProperty(layer.layer.id, 'visibility', 'none');
            } else {
                this.map.setLayoutProperty(layer.layer.id, 'visibility', 'visible');
            }

            await this.genList();
        },
        zoomTo: function(layer) {
            this.map.fitBounds(layer.bounds);
        },
        updateOpacity: function(layer) {
            this.map.setPaintProperty(layer.layer.id, 'raster-opacity', Number(layer.opacity))
        },
        removeLayer: async function(layer) {
            this.map.removeLayer(layer.layer.id);
            this.map.removeSource(layer.layer.id);
            await this.genList()
        },
        genList: async function() {
            const order = this.map.getLayersOrder()
            this.layers = order.filter((layer) => {
                return !['background'].includes(layer);
            }).filter((layer) => {
                return !(layer.endsWith('-poly') || layer.endsWith('-line') || layer.endsWith('-text') || layer.startsWith('td-'))
            }).map((layer) => {
                layer = this.map.getLayer(layer);

                let name = layer.id
                if (layer.id === 'cots') name = 'CoT Icons';

                const res = {
                    name,
                    visible: this.map.getLayoutProperty(layer.id, 'visibility') !== 'none',
                    bounds: null,
                    opacity: 1,
                    type: layer.type,
                    layer
                }

                if (layer.id.startsWith('data-')) {
                    const source = this.map.getSource(layer.source);
                    if (source.bounds) res.bounds = source.bounds;
                }

                return res;
            })
        }
    },
    components: {
        TablerRange,
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
