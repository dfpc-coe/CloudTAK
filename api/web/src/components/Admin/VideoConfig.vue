<template>
    <div class='col-12 py-2 g-2'>
        <div class='row g-0'>
            <TablerToggle
                v-model='config.api'
                :disabled='disabled'
                label='Config API Enabled'
            />

            <TablerToggle
                v-model='config.metrics'
                :disabled='disabled'
                label='Metrics Enabled'
            />

            <TablerToggle
                v-model='config.pprof'
                :disabled='disabled'
                label='Performance Metrics Enabled'
            />

            <TablerToggle
                v-model='config.playback'
                :disabled='disabled'
                label='Playback API Enabled'
            />

            <TablerToggle
                v-model='config.rtsp'
                :disabled='disabled'
                label='RTSP Endpoint Enabled'
            />

            <TablerToggle
                v-model='config.rtmp'
                :disabled='disabled'
                label='RTMP Endpoint Enabled'
            />

            <TablerToggle
                v-model='config.hls'
                :disabled='disabled'
                label='HLS Endpoint Enabled'
            />

            <TablerToggle
                v-model='config.webrtc'
                :disabled='disabled'
                label='WebRTC Endpoint Enabled'
            />

            <TablerToggle
                v-model='config.srt'
                :disabled='disabled'
                label='SRT Endpoint Enabled'
            />
        </div>


        <label class='subheader mx-2'>Server Paths</label>
        <TablerNone
            v-if='service.paths.length === 0'
            :create='false'
            :compact='true'
            label='Server Paths'
        />
        <template v-else>
            <div
                v-for='path in service.paths'
                class='hover-light px-2 py-2'
            >
                <span v-text='path.name' />
            </div>
        </template>
    </div>
</template>

<script>
import {
    TablerNone,
    TablerToggle
} from '@tak-ps/vue-tabler';

export default {
    name: 'VideoConfig',
    components: {
        TablerNone,
        TablerToggle
    },
    props: {
        service: Object,
        disabled: {
            type: Boolean,
            default: true
        }
    },
    data: function() {
        return {
            config: JSON.parse(JSON.stringify(this.service.config))
        }
    }
}
</script>
