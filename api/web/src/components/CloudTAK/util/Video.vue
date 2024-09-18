<template>
    <div>
        <TablerLoading v-if='loading' />
        <template v-else-if='!protocols || !protocols.hls'>
            <TablerNone
                label='HLS Streaming Protocol'
                :create='false'
            />
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
                    type='application/x-mpegURL' 
                    :src='protocols.hls.url'
                >
            </video>
        </template>
    </div>
</template>

<script lang='ts'>
import { defineComponent } from 'vue'
import { std } from '../../../../src/std.ts';
import type Player from 'video.js/dist/types/player.d.ts';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import type { VideoLease } from '../../../types.ts';
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default defineComponent({
    name: 'CoTVideo',
    components: {
        TablerNone,
        TablerLoading
    },
    props: {
        video: {
            type: String,
            required: true
        }
    },
    data: function(): {
        loading: boolean,
        lease?: VideoLease["lease"],
        player?: Player,
        protocols?: VideoLease["protocols"]
    } {
        return {
            loading: true
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
                    ephemeral: true,
                    duration: 1 * 60 * 60,
                    proxy: this.video
                }
            }) as VideoLease

            this.lease = lease;
            this.protocols = protocols;
        }
    }
})
</script>
