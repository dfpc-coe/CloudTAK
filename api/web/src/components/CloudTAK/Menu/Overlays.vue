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
        <div class='col-12 py-2 px-2 d-flex align-items-center'>
            <EyeIcon v-if='layer.visible' @click='flipVisible(layer)' class='cursor-pointer'/>
            <EyeOffIcon v-else @click='flipVisible(layer)' class='cursor-pointer'/>

            <span class='mx-2'>
                <MapIcon v-if='layer.type === "raster"'/>
                <VectorIcon v-else/>
            </span>
            <span class='mx-2' v-text='layer.name'/>
        </div>
    </div>
</div>
</template>

<script>
import {
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

                return {
                    name,
                    visible: this.map.getLayoutProperty(layer.id, 'visibility') !== 'none',
                    type: layer.type,
                    layer
                }
            })
        }
    },
    components: {
        EyeIcon,
        EyeOffIcon,
        PlusIcon,
        VectorIcon,
        MapIcon
    }
}
</script>
