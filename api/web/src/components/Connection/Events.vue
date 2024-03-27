<template>
<div>
    <div class='card-header'>
        <h3 class='card-title'>Connection Events</h3>

        <div class='ms-auto'>
            <div class='btn-list'>
                <IconTrash v-tooltip='"Clear Events"'  @click='events = []' size='32' class='cursor-pointer'/>

                <IconPlayerPlay v-tooltip='"Play Events"' @click='paused = false' size='32' class='cursor-pointer' v-if='paused'/>
                <IconPlayerPause v-tooltip='"Pause Events"' @click='paused = true' size='32' class='cursor-pointer' v-else/>
            </div>
        </div>
    </div>
    <pre v-text='eventStr'/>
</div>
</template>

<script>
import { stdurl } from '/src/std.ts';
import {
    IconTrash,
    IconPlayerPlay,
    IconPlayerPause
} from '@tabler/icons-vue';

export default {
    name: 'ConnectionEvents',
    data: function() {
        return {
            ws: null,
            paused: false,
            events: []
        };
    },
    computed: {
        eventStr: function() {
            return this.events.join('\n');
        }
    },
    unmounted: function() {
        this.ws.close();
    },
    mounted: function() {
        const url = stdurl('/api');
        url.searchParams.append('connection', this.$route.params.connectionid);
        url.searchParams.append('token', localStorage.token);
        if (window.location.hostname === 'localhost') {
            url.protocol = 'ws:';
        } else {
            url.protocol = 'wss:';
        }

        this.ws = new WebSocket(url);
        this.ws.addEventListener('error', (err) => { this.$emit('err', err) });

        this.ws.addEventListener('message', (msg) => {
            msg = JSON.parse(msg.data);
            if (this.paused) return;
            if (msg.type !== 'cot' || msg.connection !== parseInt(this.$route.params.connectionid)) return;

            if (this.events.length > 200) this.events.pop();
            this.events.unshift(JSON.stringify(msg.data));
        });
    },
    components: {
        IconTrash,
        IconPlayerPause,
        IconPlayerPlay
    }
}
</script>
