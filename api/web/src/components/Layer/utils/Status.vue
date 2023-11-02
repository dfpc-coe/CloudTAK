<template>
<div class='d-flex justify-content-center align-items-center' style='width: 36px;'>
    <template v-if='!layer.enabled'>
        <PlayerPauseIcon/>
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
    PlayerPauseIcon
} from 'vue-tabler-icons';

export default {
    name: 'LayerStatus',
    props: {
        layer: Object
    },
    components: {
        PlayerPauseIcon
    }
}
</script>
