<template>
    <StandardItem
        class='d-flex align-items-center'
    >
        <div class='icon-wrapper d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25 ms-2 my-2'>
            <component
                :is='protocolIcon(basemap.protocol)'
                :size='24'
                stroke='1'
            />
        </div>
        <span class='fw-semibold ms-3 flex-grow-1'>{{ basemap.name }}</span>

        <div class='d-flex align-items-center me-2'>
            <TablerBadge
                v-if='basemap.username'
                class='mx-1'
                background-color='#d63939'
            >
                Private
            </TablerBadge>

            <TablerBadge
                v-if='basemap.hidden'
                class='mx-1'
                background-color='#d63939'
            >
                Hidden
            </TablerBadge>

            <slot name='actions' />
        </div>
    </StandardItem>
</template>

<script setup lang='ts'>
import StandardItem from './StandardItem.vue';
import { TablerBadge } from '@tak-ps/vue-tabler';
import { BasemapTypeConfig } from '../Menu/Basemaps/types.ts';
import type { BasemapSourceType } from '../Menu/Basemaps/types.ts';
import type { Basemap } from '../../../types.ts';
import { IconGridDots } from '@tabler/icons-vue';

defineProps<{
    basemap: Basemap;
}>();

function protocolIcon(protocol?: string) {
    if (protocol && protocol in BasemapTypeConfig) {
        return BasemapTypeConfig[protocol as BasemapSourceType].icon;
    }
    return IconGridDots;
}
</script>

<style scoped>
.icon-wrapper {
    width: 3rem;
    height: 3rem;
    min-width: 3rem;
    min-height: 3rem;
    flex-shrink: 0;
}
</style>
