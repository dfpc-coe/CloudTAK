<template>
    <div
        class='d-flex justify-content-center align-items-center'
        style='width: 36px;'
    >
        <template v-if='!props.layer.enabled'>
            <IconPlayerPause
                :size='32'
                stroke='1'
            />
        </template>
        <template v-else>
            <span
                class='status-indicator status-indicator-animated'
                :class='{
                    "status-green": props.layer.status === "healthy",
                    "status-red": props.layer.status === "alarm",
                    "status-dark": props.layer.status === "unknown",
                }'
            >
                <span class='status-indicator-circle' />
                <span class='status-indicator-circle' />
                <span class='status-indicator-circle' />
            </span>
        </template>
    </div>
</template>

<script setup lang='ts'>
import type { ETLLayer } from '../../../../types.ts';
import {
    IconPlayerPause
} from '@tabler/icons-vue';

const props = defineProps<{
    layer: ETLLayer
}>()
</script>
