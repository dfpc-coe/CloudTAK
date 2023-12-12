<template>
<div class='d-flex justify-content-center align-items-center' style='width: 36px;'>
    <template v-if='!connection.enabled'>
        <IconPlayerPause/>
    </template>
    <template v-else>
        <span class="status-indicator status-indicator-animated" :class='{
            "status-green": connection.status === "live",
            "status-red": connection.status === "dead",
            "status-dark": connection.status === "unknown",
        }'>
              <span class="status-indicator-circle"></span>
              <span class="status-indicator-circle"></span>
              <span class="status-indicator-circle"></span>
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
    props: {
        connection: Object
    },
    components: {
        IconPlayerPause
    }
}
</script>
