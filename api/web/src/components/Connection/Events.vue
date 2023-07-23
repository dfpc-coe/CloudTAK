<template>
<div class='card'>
    <div class='card-header'>
        <h3 class='card-title'>Connection Events</h3>

        <div class='ms-auto'>
            <div class='btn-list'>
                <TrashIcon v-tooltip='"Clear Events"'  @click='events = []' class='cursor-pointer'/>

                <PlayerPlayIcon v-tooltip='"Play Events"' @click='paused = false' class='cursor-pointer' v-if='paused'/>
                <PlayerPauseIcon v-tooltip='"Pause Events"' @click='paused = true' class='cursor-pointer' v-else/>
            </div>
        </div>
    </div>
    <pre v-text='eventStr'/>
</div>
</template>

<script>
import {
    TrashIcon,
    PlayerPlayIcon,
    PlayerPauseIcon
} from 'vue-tabler-icons';

export default {
    name: 'ConnectionEvents',
    props: {
        ws: {
            type: Object,
            required: true
        }
    },
    data: function() {
        return {
            paused: false,
            events: []
        };
    },
    computed: {
        eventStr: function() {
            return this.events.join('\n');
        }
    },
    mounted: function() {
        this.ws.addEventListener('message', (msg) => {
            msg = JSON.parse(msg.data);
            if (this.paused) return;
            if (msg.type !== 'cot' || msg.connection !== parseInt(this.$route.params.connectionid)) return;

            if (this.events.length > 200) this.events.pop();
            this.events.unshift(JSON.stringify(msg.data));
        });
    },
    components: {
        TrashIcon,
        PlayerPauseIcon,
        PlayerPlayIcon
    }
}
</script>
