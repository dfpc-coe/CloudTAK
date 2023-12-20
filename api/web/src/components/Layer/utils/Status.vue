<template>
<div class='d-flex justify-content-center align-items-center' style='width: 36px;'>
    <template v-if='!layer.enabled'>
        <IconPlayerPause/>
    </template>
    <template v-else>
        <span class="status-indicator status-indicator-animated" :class='{
            "status-green": layer.status === "healthy",
            "status-red": layer.status === "alarm",
            "status-dark": layer.status === "unknown",
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
    name: 'LayerStatus',
    props: {
        layer: Object
    },
    components: {
        IconPlayerPause
    }
}
</script>
