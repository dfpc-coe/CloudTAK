<template>
    <div class='col-12 py-2 g-2'>
        <TablerLoading v-if='loading'/>
        <div v-else class='row g-0'>
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

        <div v-if='!disabled' class='col-12 d-flex px-2 py-3'>
            <button class='btn btn-secondary' @click='$emit("cancel")'>Cancel</button>

            <div class='ms-auto'>
                <button class='btn btn-primary' @click='saveConfig'>Submit</button>
            </div>
        </div>

        <template v-if='disabled'>
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
        </template>
    </div>
</template>

<script>
import { std } from '/src/std.ts';
import {
    TablerNone,
    TablerLoading,
    TablerToggle
} from '@tak-ps/vue-tabler';

export default {
    name: 'VideoConfig',
    components: {
        TablerNone,
        TablerLoading,
        TablerToggle
    },
    emits: [
        'cancel'
    ],
    props: {
        service: Object,
        disabled: {
            type: Boolean,
            default: true
        }
    },
    data: function() {
        return {
            loading: false,
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
