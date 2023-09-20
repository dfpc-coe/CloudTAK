<template>
<span v-if='!layer.enabled'>
    <PlayerPauseIcon/>
</span>
<span v-else>
    <span class="status-indicator status-indicator-animated" :class='{
        "status-green": layer.status === "healthy",
        "status-red": layer.status === "alarm",
        "status-dark": layer.status === "unknown",
    }'>
          <span class="status-indicator-circle"></span>
          <span class="status-indicator-circle"></span>
          <span class="status-indicator-circle"></span>
    </span>
</span>
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
