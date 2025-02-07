<template>
    <div
        class='d-flex justify-content-center align-items-center'
        style='width: 36px;'
    >
        <template v-if='!connection.enabled'>
            <IconPlayerPause
                :size='32'
                stroke='1'
            />
        </template>
        <template v-else>
            <span
                class='status-indicator status-indicator-animated'
                :class='{
                    "status-green": connection.status === "live",
                    "status-red": connection.status === "dead",
                    "status-dark": connection.status === "unknown",
                }'
            >
                <span class='status-indicator-circle' />
                <span class='status-indicator-circle' />
                <span class='status-indicator-circle' />
            </span>
        </template>
    </div>
</template>


<script>
import {
    IconPlayerPause
} from '@tabler/icons-vue';

export default {
    name: 'ConnectionStatus',
    components: {
        IconPlayerPause
    },
    props: {
        connection: Object
    }
}
</script>
