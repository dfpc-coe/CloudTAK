<template>
    <div class='ms-3'>
        <div
            v-for='l of overlay.styles'
            :key='l.id'
        >
            <template v-if='["fill", "line", "circle"].includes(l.type)'>
                <div class='me-2'>
                    <div class='px-3 py-2 align-items-center hover-button'>
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
                    </div>

                    <OverlayLayer
                        v-if='treeState[l.id]'
                        :layer='l'
                    />
                </div>
            </template>
        </div>
    </div>
</template>

<script>
import OverlayLayer from './Layer.vue';
import {
    IconChevronDown,
    IconChevronRight,
    IconPaint,
    IconLine,
    IconCircle,
} from '@tabler/icons-vue';

export default {
    name: 'OverlayLayers',
    components: {
        OverlayLayer,
        IconChevronDown,
        IconChevronRight,
        IconPaint,
        IconLine,
        IconCircle,
    },
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
        for (const layer of this.overlay.styles) {
            this.treeState[layer.id] = false;
        }
    }
}
</script>
