<template>
<div class='row'>
    <div class='col-12 border-light border-bottom'>
        <div class='card-header my-2'>
            <div class='card-title mx-2'>Overlays</div>
            <div class='ms-auto mx-2'>
                <PlusIcon @click='$emit("datas")' class='cursor-pointer'/>
            </div>
        </div>
    </div>
    <div :key='layer.name' v-for='layer in layers' class="col-lg-12">
        <div class='row col-12 py-2 px-2 d-flex'>
            <div class='col-12 d-flex align-items-center'>
                <EyeIcon v-if='layer.visible' @click='flipVisible(layer)' class='cursor-pointer'/>
                <EyeOffIcon v-else @click='flipVisible(layer)' class='cursor-pointer'/>

                <span class='mx-2'>
                    <MapIcon v-if='layer.type === "raster"'/>
                    <VectorIcon v-else/>
                </span>
                <span class='mx-2' v-text='layer.name'/>

                <div class='ms-auto btn-list'>
                    <MaximizeIcon v-if='layer.bounds' @click='zoomTo(layer)' class='cursor-pointer' v-tooltip='"Zoom To Overlay"'/>
                    <TablerDelete v-if='layer.name.startsWith("data-")' displaytype='icon' @delete='removeLayer(layer)' v-tooltip='"Delete Overlay"'/>
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
    MaximizeIcon,
    VectorIcon,
    EyeOffIcon,
    PlusIcon,
    EyeIcon,
    MapIcon
} from 'vue-tabler-icons';

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
                return !(layer.endsWith('-poly') || layer.endsWith('-line'))
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
        MaximizeIcon,
        EyeIcon,
        EyeOffIcon,
        PlusIcon,
        VectorIcon,
        MapIcon
    }
}
</script>
