<template>
    <TablerModal>
        <div class='modal-status bg-red' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='$emit("close")'
        />

        <div class='modal-header'>
            <div class='strong d-flex align-items-center'>Public Tiles</div>
        </div>
        <TablerLoading desc='Loading Public Tiles' />
    </TablerModal>
</template>

<script setup lang='ts'>
import { onMounted } from 'vue'
import { std } from '../../../std.ts';
import {
    TablerModal,
    TablerLoading
} from '@tak-ps/vue-tabler'

const emit = defineEmits([
    'close',
    'select'
]);

onMounted(async () => {
    const basemaps = await std('/api/basemap?limit=1');

    const files = await std(new URL('/public', basemaps.tiles.url));
})
</script>
