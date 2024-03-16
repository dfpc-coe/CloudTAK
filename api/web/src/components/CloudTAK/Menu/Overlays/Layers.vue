<template>
<div>
    <OverlayLayer v-if='layer' :layer='layer' @close='layer = false'/>
    <template v-else>
        <div class='col-12 border-bottom border-light'>
            <div class='modal-header px-0 mx-2'>
                <IconCircleArrowLeft @click='$emit("close")' size='32' class='cursor-pointer'/>
                <div class='modal-title' v-text='overlay.name'></div>
                <div class='btn-list'></div>
            </div>
        </div>
        <div :key='l' v-for='l of overlay.layers' class="col-lg py-2 px-3 hover-dark">
            <div class='py-2 px-2 hover-dark cursor-pointer'>
                <div @click='layer = l' class='user-select-none' v-text='l.id'/>
            </div>
        </div>
    </template>
</div>
</template>

<script>
import OverlayLayer from './Layer.vue';
import {
    TablerDelete,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import {
    IconCircleArrowLeft,
    IconPlus,
} from '@tabler/icons-vue';
import { useMapStore } from '/src/stores/map.js';
import { mapState } from 'pinia'
const mapStore = useMapStore();

export default {
    name: 'OverlayLayers',
    props: {
        overlay: {
            type: Object,
            required: true
        }
    },
    data: function() {
        return {
            err: false,
            loading: false,
            layer: false
        }
    },
    computed: {
        ...mapState(useMapStore, ['layers'])
    },
    components: {
        OverlayLayer,
        TablerLoading,
        TablerDelete,
        IconCircleArrowLeft,
        IconPlus,
    }
}
</script>
