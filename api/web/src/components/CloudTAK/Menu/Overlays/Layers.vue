<template>
<div>
    <OverlayLayer v-if='layer' :layer='layer' @close='layer = false'/>
    <template v-else>
        <MenuTemplate :name='overlay.name'>
            <div @click='layer = l' :key='l' v-for='l of overlay.layers' class="col-lg py-2 px-3 hover-dark">
                <div class='py-2 px-2 hover-dark cursor-pointer d-flex align-items-center'>
                    <span>
                        <IconPaint v-if='l.type === "fill"' size='24'/>
                        <IconLine v-else-if='l.type === "line"' size='24'/>
                        <IconCircle v-else-if='l.type === "circle"' size='24'/>
                    </span>

                    <div class='user-select-none mx-2' v-text='l.id || l.name'/>
                </div>
            </div>
        </MenuTemplate>
    </template>
</div>
</template>

<script>
import MenuTemplate from '../../util/MenuTemplate.vue';
import OverlayLayer from './Layer.vue';
import {
    IconPaint,
    IconLine,
    IconCircle,
} from '@tabler/icons-vue';
import { useMapStore } from '/src/stores/map.ts';
import { mapState } from 'pinia'

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
        IconPaint,
        IconLine,
        IconCircle,
        MenuTemplate,
    }
}
</script>
