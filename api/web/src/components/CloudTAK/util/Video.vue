<template>
    <div>
        <TablerLoading v-if='loading'/>
        <template v-else>
            <video
                id='cot-player'
                class='video-js vjs-default-skin'
                width='400'
                height='300'
                controls
            >
                <source
                    type='application/x-mpegURL'
                    :src='video'
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
        }
    },
    unmounted: function() {
        this.player.dispose();
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
            this.lease = await std('/api/video/lease', {
                method: 'POST',
                body:  {
                    name: 'Temporary Lease',
                    duration: 1 * 60 * 60,
                    proxy: this.video
                }
            })
        }
    },
    components: {
        TablerLoading
    }
}
</script>
