<template>
    <div
        class='d-flex justify-content-center align-items-center'
        style='width: 36px;'
    >
        <template v-if='props.connection.readonly'>
            <IconNetwork
                :size='32'
                stroke='1'
            />
        </template>
        <template v-else-if='!props.connection.enabled'>
            <IconPlayerPause
                :size='32'
                stroke='1'
            />
        </template>
        <template v-else>
            <span
                class='status-indicator status-indicator-animated'
                :class='{
                    "status-green": props.connection.status === "live",
                    "status-red": props.connection.status === "dead",
                    "status-dark": props.connection.status === "unknown",
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
import {
    IconNetwork,
    IconPlayerPause
} from '@tabler/icons-vue';

const props = defineProps({
    connection: {
        type: Object,
        required: true
    }
});
</script>
