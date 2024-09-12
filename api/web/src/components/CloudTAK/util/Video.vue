<template>
    <div>
        <video
            id="cot-player"
            class="video-js vjs-default-skin"
            width="400"
            height="300"
            controls
        >
            <source
                type="application/x-mpegURL"
                :src="video"
            />
        </video>
    </div>
</template>

<script>
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

export default {
    name: 'CoTVideo',
    data: function() {
        return {
            player: false
        }
    },
    props: {
        video: {
            type: String,
            required: true
        }
    },
    unmounted: function() {
        this.player.dispose();
    },
    mounted: async function() {
        this.$nextTick(() => {
            this.player = videojs('cot-player');
        });
    }
}
</script>
