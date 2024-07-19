<template>
<div class='ms-3'>
    <div
        :key='l.id'
        v-for='l of overlay._layers'
    >
        <template v-if='["fill", "line", "circle"].includes(l.type)'>
            <div
                class='cursor-pointer align-items-center px-3 py-2 me-2 hover-button'
                @click='treeState[l.id] = true'
            >
                <IconChevronRight
                    v-if='!treeState[l.id]'
                    :size='20'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='treeState[l.id] = true'
                />
                <IconChevronDown
                    v-else-if='treeState[l.id]'
                    :size='20'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='treeState[l.id] = false'
                />
                <IconPaint
                    v-if='l.type === "fill"'
                    :size='24'
                    :stroke='1'
                />
                <IconLine
                    v-else-if='l.type === "line"'
                    :size='24'
                    :stroke='1'
                />
                <IconCircle
                    v-else-if='l.type === "circle"'
                    :size='24'
                    :stroke='1'
                />

                <span
                    class='user-select-none mx-2'
                    v-text='l.id || l.name'
                />

                <OverlayLayer
                    v-if='layer'
                    :layer='l'
                />
            </div>
        </template>
    </div>
</div>
</template>

<script>
import MenuTemplate from '../../util/MenuTemplate.vue';
import OverlayLayer from './Layer.vue';
import {
    IconChevronDown,
    IconChevronRight,
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
            treeState: {},
        }
    },
    mounted: function() {
        for (const layer of this.overlay._layers) {
            this.treeState[layer.id] = false;
        }
    },
    components: {
        OverlayLayer,
        IconChevronDown,
        IconChevronRight,
        IconPaint,
        IconLine,
        IconCircle,
        MenuTemplate,
    }
}
</script>
