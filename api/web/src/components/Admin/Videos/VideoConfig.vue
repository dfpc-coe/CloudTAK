<template>
    <div class='col-12 py-2 g-2'>
        <TablerLoading v-if='loading' />
        <div
            v-else
            class='row g-0 px-2'
        >
            <div class='col-12'>
                <TablerToggle
                    v-model='config.api'
                    :disabled='disabled'
                    class='subheader'
                    label='Config API Enabled'
                />
                <div
                    v-if='config.api'
                    id='api-container'
                    class='col-12 border rounded px-2 py-2'
                >
                    <TablerInput
                        v-model='config.apiAddress'
                        label='Port'
                        :disabled='true'
                    />
                </div>
            </div>

            <div class='col-12 pt-2'>
                <TablerToggle
                    v-model='config.metrics'
                    :disabled='disabled'
                    class='subheader'
                    label='Metrics API Enabled'
                />
                <div
                    v-if='config.metrics'
                    id='metrics-container'
                    class='col-12 border rounded px-2 py-2'
                >
                    <TablerInput
                        v-model='config.metricsAddress'
                        label='Port'
                        :disabled='true'
                    />
                </div>
            </div>

            <div class='col-12 pt-2'>
                <TablerToggle
                    v-model='config.pprof'
                    :disabled='disabled'
                    class='subheader'
                    label='Performance API Enabled'
                />
                <div
                    v-if='config.pprof'
                    id='pprof-container'
                    class='col-12 border rounded px-2 py-2'
                >
                    <TablerInput
                        v-model='config.pprofAddress'
                        label='Port'
                        :disabled='true'
                    />
                </div>
            </div>

            <div class='col-12 pt-2'>
                <TablerToggle
                    v-model='config.playback'
                    :disabled='disabled'
                    class='subheader'
                    label='Playback API Enabled'
                />
                <div
                    v-if='config.playback'
                    id='playback-container'
                    class='col-12 border rounded px-2 py-2'
                >
                    <TablerInput
                        v-model='config.playbackAddress'
                        label='Port'
                        :disabled='true'
                    />
                </div>
            </div>

            <div class='col-12 pt-2'>
                <TablerToggle
                    v-model='config.rtsp'
                    :disabled='disabled'
                    class='subheader'
                    label='RTSP API Enabled'
                />
                <div
                    v-if='config.rtsp'
                    id='rtsp-container'
                    class='col-12 border rounded px-2 py-2'
                >
                    <TablerInput
                        v-model='config.rtspAddress'
                        label='Port'
                        :disabled='true'
                    />
                </div>
            </div>

            <div class='col-12 pt-2'>
                <TablerToggle
                    v-model='config.rtmp'
                    :disabled='disabled'
                    class='subheader'
                    label='RTMP API Enabled'
                />
                <div
                    v-if='config.rtmp'
                    id='rtmp-container'
                    class='col-12 border rounded px-2 py-2'
                >
                    <TablerInput
                        v-model='config.rtmpAddress'
                        label='Port'
                        :disabled='true'
                    />
                </div>
            </div>

            <div class='col-12 pt-2'>
                <TablerToggle
                    v-model='config.hls'
                    :disabled='disabled'
                    class='subheader'
                    label='HLS API Enabled'
                />
                <div
                    v-if='config.hls'
                    id='hls-container'
                    class='col-12 border rounded px-2 py-2'
                >
                    <TablerInput
                        v-model='config.hlsAddress'
                        label='Port'
                        :disabled='true'
                    />
                </div>
            </div>

            <div class='col-12 pt-2'>
                <TablerToggle
                    v-model='config.webrtc'
                    :disabled='disabled'
                    class='subheader'
                    label='WebRTC API Enabled'
                />
                <div
                    v-if='config.webrtc'
                    id='webrtc-container'
                    class='col-12 border rounded px-2 py-2'
                >
                    <TablerInput
                        v-model='config.webrtcAddress'
                        label='Port'
                        :disabled='true'
                    />
                </div>
            </div>

            <div class='col-12 pt-2'>
                <TablerToggle
                    v-model='config.srt'
                    :disabled='disabled'
                    class='subheader'
                    label='SRT API Enabled'
                />
                <div
                    v-if='config.srt'
                    id='srt-container'
                    class='col-12 border rounded px-2 py-2'
                >
                    <TablerInput
                        v-model='config.srtAddress'
                        label='Port'
                        :disabled='true'
                    />
                </div>
            </div>
        </div>

        <div
            v-if='!disabled'
            class='col-12 d-flex px-2 py-3'
        >
            <button
                class='btn btn-secondary'
                @click='$emit("cancel")'
            >
                Cancel
            </button>

            <div class='ms-auto'>
                <button
                    class='btn btn-primary'
                    @click='saveConfig'
                >
                    Submit
                </button>
            </div>
        </div>

        <template v-if='disabled'>
            <div class='row g-0 px-2'>
                <label class='subheader mx-2'>Server Paths</label>
                <div class='col-12 border rounded px-2 py-2'>
                    <TablerNone
                        v-if='service.paths.length === 0'
                        :create='false'
                        :compact='true'
                        label='Server Paths'
                    />
                    <template v-else>
                        <div
                            v-for='path in service.paths'
                            class='hover-light px-2 py-2 cursor-pointer'
                            @click='pathid = path.name'
                        >
                            <span v-text='path.name' />
                        </div>
                    </template>
                </div>
            </div>
        </template>
    </div>

    <VideoConfigPath
        v-if='pathid'
        :pathid='pathid'
        @close='pathid = false'
    />
</template>

<script>
import { std } from '/src/std.ts';
import VideoConfigPath from './VideoConfigPath.vue';
import {
    TablerNone,
    TablerInput,
    TablerLoading,
    TablerToggle
} from '@tak-ps/vue-tabler';

export default {
    name: 'VideoConfig',
    components: {
        TablerNone,
        TablerInput,
        TablerLoading,
        TablerToggle,
        VideoConfigPath
    },
    props: {
        service: Object,
        disabled: {
            type: Boolean,
            default: true
        }
    },
    emits: [
        'cancel'
    ],
    data: function() {
        return {
            loading: false,
            pathid: false,
            config: JSON.parse(JSON.stringify(this.service.config))
        }
    },
    methods: {
        saveConfig: async function() {
            this.loading = true;

            await std('/api/video/service', {
                method: 'PATCH',
                body: this.config
            });

            this.loading = false;
            this.$emit('cancel');
        },
    }
}
</script>
