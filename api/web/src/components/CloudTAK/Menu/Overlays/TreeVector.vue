<template>
    <div>
        <OverlayLayer
            v-if='layer'
            :layer='layer'
            @close='layer = false'
        />

        <template v-else>
            <div class='ms-3'>
                <div
                    :key='l.id'
                    v-for='l of overlay._layers'
                >
                    <template v-if='["fill", "line", "circle"].includes(l.type)'>
                        <div
                            class='cursor-pointer align-items-center px-3 py-2 me-2 hover-button'
                            @click='layer = l'
                        >
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
                    </template>
                </div>
            </div>
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
