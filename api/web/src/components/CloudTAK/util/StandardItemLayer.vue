<template>
    <StandardItem
        class='h-100'
        @click='$emit("click")'
    >
        <div class='d-flex align-items-center gap-3 px-3 py-2'>
            <img
                v-if='layer.integration.icon'
                :src='layer.integration.icon'
                :alt='layer.integration.name'
                class='rounded flex-shrink-0'
                style='height: 48px; width: 48px; object-fit: contain;'
            >
            <div
                v-else
                class='icon-wrapper d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25 flex-shrink-0'
                style='width: 48px; height: 48px;'
            >
                <IconBrandDocker
                    :size='28'
                    stroke='1'
                />
            </div>

            <div class='flex-grow-1 overflow-hidden'>
                <div class='d-flex align-items-center'>
                    <LayerStatus :layer='layer' />
                    <span
                        class='ms-2 fw-semibold text-truncate'
                        v-text='layer.name'
                    />
                </div>
                <div class='d-flex align-items-center gap-1 text-white-50 small'>
                    <component
                        :is='type.icon'
                        :size='16'
                        stroke='1'
                    />
                    <span v-text='type.label' />
                    <span class='mx-1'>&middot;</span>
                    <span
                        class='text-truncate'
                        v-text='layer.integration.name'
                    />
                </div>
            </div>

            <slot name='actions' />
        </div>
    </StandardItem>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import StandardItem from './StandardItem.vue';
import LayerStatus from '../../ETL/Layer/utils/StatusDot.vue';
import type { ETLLayer } from '../../../types.ts';
import {
    IconExchange,
    IconStackPop,
    IconStackPush,
    IconStack,
    IconBrandDocker,
} from '@tabler/icons-vue';

const props = defineProps<{
    layer: ETLLayer;
}>();

defineEmits<{
    (e: 'click'): void;
}>();

const type = computed(() => {
    if (props.layer.incoming && props.layer.outgoing) return { label: 'Incoming & Outgoing', icon: IconExchange };
    if (props.layer.outgoing) return { label: 'Outgoing', icon: IconStackPop };
    if (props.layer.incoming) return { label: 'Incoming', icon: IconStackPush };
    return { label: 'Unconfigured', icon: IconStack };
});
</script>
