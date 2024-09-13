<template>
    <div>
        <TablerLoading v-if='loading'/>
        <template v-else-if='!protocols.hls'>
            <TablerNone label='HLS Streaming Protocol'/>
        </template>
        <template v-else>
            <video
                id='cot-player'
                class='video-js vjs-default-skin'
                width='400'
                height='300'
                controls='true'
                autoplay='true'
            >
                <source
                    :src='protocols.hls.url'
                >
            </video>
        </template>
    </div>
</template>

<script lang='ts'>
import { std } from '/src/std.ts';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'CoTVideo',
    props: {
        video: {
            type: String,
            required: true
        }
    },
    data: function() {
        return {
            loading: true,
            player: false,
            lease: false,
            protocols: {}
        }
    },
    unmounted: function() {
        if (this.player) {
            this.player.dispose();
        }
    },
    mounted: async function() {
        await this.requestLease();


        this.loading = false;
        this.$nextTick(() => {
            this.player = videojs('cot-player');
        });
    },
    methods: {
        requestLease: async function() {
            const { lease, protocols } = await std('/api/video/lease', {
                method: 'POST',
                body:  {
                    name: 'Temporary Lease',
                    duration: 1 * 60 * 60,
                    proxy: this.video
                }
            })

            this.lease = lease;
            this.protocols = protocols;
        }
    },
    components: {
        TablerNone,
        TablerLoading
    }
}
</script>
