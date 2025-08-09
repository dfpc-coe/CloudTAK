<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                Connection Events
            </h3>

            <div class='ms-auto'>
                <div class='btn-list'>
                    <IconTrash
                        v-tooltip='"Clear Events"'
                        :size='32'
                        stroke='1'
                        class='cursor-pointer'
                        @click='events = []'
                    />

                    <IconPlayerPlay
                        v-if='paused'
                        v-tooltip='"Play Events"'
                        :size='32'
                        stroke='1'
                        class='cursor-pointer'
                        @click='paused = false'
                    />
                    <IconPlayerPause
                        v-else
                        v-tooltip='"Pause Events"'
                        :size='32'
                        stroke='1'
                        class='cursor-pointer'
                        @click='paused = true'
                    />
                </div>
            </div>
        </div>
        <pre v-text='eventStr' />
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
    components: {
        IconTrash,
        IconPlayerPause,
        IconPlayerPlay
    },
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
    }
}
</script>
