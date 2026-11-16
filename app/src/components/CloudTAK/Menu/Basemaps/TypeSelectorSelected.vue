<template>
    <div class='col-12'>
        <StandardItem class='d-flex align-items-center gap-3 px-3 py-3'>
            <div class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25 p-2'>
                <component
                    :is='config.icon'
                    :size='28'
                    stroke='1.5'
                />
            </div>

            <div>
                <div class='fw-semibold d-flex align-items-center gap-2'>
                    {{ config.label }}
                    <TablerBadge
                        v-if='config.beta'
                        class='rounded-pill small'
                        background-color='rgba(255, 171, 0, 0.15)'
                        border-color='rgba(255, 171, 0, 0.35)'
                        text-color='#c98500'
                    >
                        Beta
                    </TablerBadge>
                </div>
                <div class='small text-white-50'>
                    {{ config.description }}
                </div>
            </div>

            <div class='ms-auto'>
                <button
                    type='button'
                    class='btn btn-sm btn-secondary'
                    @click='emit("change-type")'
                >
                    Change Type
                </button>
            </div>
        </StandardItem>
    </div>
</template>

<script setup lang='ts'>
import StandardItem from '../../util/StandardItem.vue';
import { TablerBadge } from '@tak-ps/vue-tabler';
import type { BasemapSourceType } from './types.ts';
import { BasemapTypeConfig } from './types.ts';

const props = defineProps<{
    type: BasemapSourceType;
}>();

const emit = defineEmits<{
    'change-type': [];
}>();

const config = BasemapTypeConfig[props.type];
</script>